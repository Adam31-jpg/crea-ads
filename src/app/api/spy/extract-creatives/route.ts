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
        if (!storeAnalysis) return NextResponse.json({ error: "not_found" }, { status: 404 });

        const competitors = await prisma.competitorAnalysis.findMany({
            where: { id: { in: competitorIds }, storeAnalysisId },
        });
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) return NextResponse.json({ error: "configuration_error" }, { status: 500 });

        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const allBlueprints: object[] = [];

        for (const competitor of competitors) {
            const lines = [
                `You are Lumina's Ad Creative Analyst. Research ALL advertising and marketing content of ${competitor.competitorName} (${competitor.competitorUrl ?? "search for their website"}).`,
                "",
                "SEARCH SCOPE — analyze ALL channels:",
                "1. Meta Ads: Search Meta Ad Library for active/recent ads",
                "2. TikTok Ads: Search TikTok ad campaigns and promoted content",
                "3. Google Ads: Display ads, Shopping ads, search ads",
                "4. Instagram organic: Top-performing posts",
                "5. TikTok organic: Viral videos",
                "6. Facebook posts: Top page posts",
                "7. YouTube: Video ads or product reviews",
                "",
                "For each creative pattern return ALL fields:",
                "- creativeName: string",
                '- creativeType: "ugc_video" | "flat_lay" | "comparison" | "asmr" | "lifestyle" | "carousel" | "testimonial"',
                "- description: string (what makes it effective, visual style, hook)",
                '- estimatedPerformance: { hookRate: string, engagement: string, format: string }',
                `- reproductionPrompt: string (Fal.ai prompt — describe SCENE/ENVIRONMENT only for ${storeAnalysis.storeName ?? "the brand"}, never mention "a product" directly)`,
                '- aspectRatio: "9:16" | "1:1" | "16:9" | "4:5"',
                '- sourceLabel: "cloned_from_competitor"',
                '- sourceUrl: string | null (DIRECT URL to the specific post/ad e.g. "https://www.facebook.com/ads/library/?id=123" or "https://www.instagram.com/p/ABC/". null if not found)',
                "- sourceImageUrl: string | null (direct URL to image/thumbnail. null if not found)",
                '- sourcePlatform: "meta_ads" | "tiktok_ads" | "google_ads" | "instagram_organic" | "tiktok_organic" | "facebook_organic" | "youtube"',
                "",
                "For ugc_video also include ugcScript: string (HOOK 0-3s, BODY 3-18s, CTA 18-22s with camera directions)",
                "",
                "Generate 2-4 creatives. Return ONLY a JSON array. If no specific ads found, generate from niche trends, set sourceLabel to \"market_trend\" and sourceUrl to null.",
                "",
                `LANGUAGE: Marketing copy (headlines, CTAs, overlay text), ugcScript, creativeName in ${langLabel}. Scene descriptions in English.`,
            ];
            const prompt = lines.join("\n");

            let blueprintsRaw: Array<{
                creativeName: string;
                creativeType: string;
                description: string;
                estimatedPerformance?: object;
                reproductionPrompt: string;
                ugcScript?: string;
                aspectRatio?: string;
                sourceLabel?: string;
                sourceUrl?: string | null;
                sourceImageUrl?: string | null;
                sourcePlatform?: string | null;
            }> = [];

            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config: { tools: [{ googleSearch: {} }] },
                });
                const text = response.text ?? "[]";
                const cleaned = text
                    .replace(/```json\n?/g, "")
                    .replace(/```\n?/g, "")
                    .trim();
                blueprintsRaw = JSON.parse(cleaned);
            } catch {
                console.error(
                    `[spy/extract-creatives] Failed for competitor ${competitor.competitorName}`,
                );
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
                            sourceUrl: b.sourceUrl ?? null,
                            sourceImageUrl: b.sourceImageUrl ?? null,
                            sourcePlatform: b.sourcePlatform ?? null,
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

        return NextResponse.json({ status: "done", blueprints: allBlueprints });
    } catch (err) {
        console.error("[spy/extract-creatives]", err);
        return NextResponse.json({ status: "failed", error: "internal_error" }, { status: 500 });
    }
}
