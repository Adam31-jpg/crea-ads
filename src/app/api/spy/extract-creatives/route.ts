import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import { broadcast } from "@/lib/sse";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;

        const body = await req.json();
        const { storeAnalysisId, competitorIds, targetLanguage = "fr" } = body as {
            storeAnalysisId: string;
            competitorIds: string[];
            targetLanguage?: string;
        };

        const langNames: Record<string, string> = {
            fr: "French",
            en: "English",
            de: "German",
            es: "Spanish",
            it: "Italian",
        };
        const langLabel = langNames[targetLanguage] ?? "French";

        if (!storeAnalysisId || !Array.isArray(competitorIds) || competitorIds.length === 0) {
            return NextResponse.json(
                { error: "storeAnalysisId and competitorIds are required" },
                { status: 400 },
            );
        }

        const storeAnalysis = await prisma.storeAnalysis.findFirst({
            where: { id: storeAnalysisId, userId },
        });

        if (!storeAnalysis) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const competitors = await prisma.competitorAnalysis.findMany({
            where: { id: { in: competitorIds }, storeAnalysisId },
        });

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            return NextResponse.json({ error: "configuration_error" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const allBlueprints: object[] = [];

        for (const competitor of competitors) {
            const prompt = `You are Lumina's Ad Creative Analyst. Research the advertising strategy of ${competitor.competitorName} (${competitor.competitorUrl ?? "unknown URL"}).
Search for their Facebook ads, Instagram ads, TikTok content, and marketing campaigns.
For each identifiable ad creative pattern, generate a reproduction blueprint:
- creativeName: string (e.g., "POV Energy Replacement", "Flat-Lay Premium Product")
- creativeType: "ugc_video" | "flat_lay" | "comparison" | "asmr" | "lifestyle" | "carousel" | "testimonial"
- description: string (detailed description of the original creative — format, angle, hook, visual style, what makes it effective)
- estimatedPerformance: { hookRate: string, engagement: string, format: string }
- reproductionPrompt: string (a detailed Fal.ai image generation prompt that would recreate a similar creative for the user's product: ${storeAnalysis.storeName ?? "the brand"}. Include the product category, visual style, lighting, composition, and mood. The prompt must describe the SCENE AND ENVIRONMENT, never mention "a product" — the product image is provided separately via image_urls.)
- aspectRatio: "9:16" | "1:1" | "16:9" | "4:5"
- sourceLabel: "cloned_from_competitor"
If creativeType is "ugc_video", also include:
- ugcScript: string (a complete UGC video script with HOOK (0-3s), BODY (3-18s), CTA (18-22s), including camera directions and text overlays)
Generate 2-4 creatives per competitor. Return ONLY a JSON array.
If you cannot find specific ads for this competitor, generate creatives based on what typically performs in ${storeAnalysis.niche ?? "this niche"}. Set sourceLabel to "market_trend" for these.

LANGUAGE REQUIREMENT: All reproductionPrompt marketing copy (headlines, CTAs, overlay text), ugcScript content (hook, body, CTA), and creativeName must be generated in ${langLabel}. The scene description in reproductionPrompt (lighting, composition, environment) stays in English for the image model, but any text that would appear ON the creative must be in ${langLabel}.`;

            let blueprintsRaw: Array<{
                creativeName: string;
                creativeType: string;
                description: string;
                estimatedPerformance?: object;
                reproductionPrompt: string;
                ugcScript?: string;
                aspectRatio?: string;
                sourceLabel?: string;
            }> = [];

            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config: {
                        tools: [{ googleSearch: {} }],
                    },
                });
                const text = response.text ?? "[]";
                const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                blueprintsRaw = JSON.parse(cleaned);
            } catch {
                // Log failure but continue with remaining competitors
                console.error(`[spy/extract-creatives] Failed for competitor ${competitor.competitorName}`);
                broadcast(userId, {
                    type: "creative_extraction_failed",
                    competitorId: competitor.id,
                    competitorName: competitor.competitorName,
                });
                continue;
            }

            if (!Array.isArray(blueprintsRaw)) continue;

            const created = await Promise.all(
                blueprintsRaw.map((b) =>
                    prisma.creativeBlueprint.create({
                        data: {
                            competitorAnalysisId: competitor.id,
                            storeAnalysisId,
                            creativeName: b.creativeName ?? "Untitled Creative",
                            creativeType: b.creativeType ?? "lifestyle",
                            description: b.description ?? "",
                            estimatedPerformance: b.estimatedPerformance
                                ? (b.estimatedPerformance as unknown as Prisma.InputJsonValue)
                                : undefined,
                            reproductionPrompt: b.reproductionPrompt ?? "",
                            ugcScript: b.ugcScript ?? null,
                            aspectRatio: b.aspectRatio ?? "9:16",
                            sourceLabel: b.sourceLabel ?? "cloned_from_competitor",
                            status: "ready",
                        },
                    }),
                ),
            );

            allBlueprints.push(...created);

            broadcast(userId, {
                type: "creatives_extracted",
                competitorId: competitor.id,
                competitorName: competitor.competitorName,
                count: created.length,
            });
        }

        return NextResponse.json({
            status: "done",
            blueprints: allBlueprints,
        });
    } catch (err) {
        console.error("[spy/extract-creatives]", err);
        return NextResponse.json({ status: "failed", error: "internal_error" }, { status: 500 });
    }
}
