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
        const {
            storeAnalysisId,
            competitorIds,
            existingBlueprintIds = [],
            targetLanguage = "fr",
        } = body as {
            storeAnalysisId: string;
            competitorIds: string[];
            existingBlueprintIds?: string[];
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

        // Load existing blueprints to build exclusion list
        const existingBlueprints = await prisma.creativeBlueprint.findMany({
            where: {
                storeAnalysisId,
                ...(existingBlueprintIds.length > 0 ? { id: { in: existingBlueprintIds } } : {}),
            },
            select: { creativeName: true, creativeType: true, description: true },
        });

        const exclusionList =
            existingBlueprints.length > 0
                ? existingBlueprints
                      .map(
                          (b, i) =>
                              `${i + 1}. "${b.creativeName}" (${b.creativeType}): ${b.description?.slice(0, 100) ?? ""}`,
                      )
                      .join("\n")
                : "None yet";

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
            broadcast(userId, {
                type: "expand_searching",
                competitorId: competitor.id,
                competitorName: competitor.competitorName,
            });

            const prompt = [
                `You are Lumina's Ad Creative Analyst performing an EXPANSION search. Your task is to find ADDITIONAL advertising creatives for ${competitor.competitorName} (${competitor.competitorUrl ?? "search for their website"}) that are COMPLETELY DIFFERENT from what already exists.`,
                `
CREATIVES ALREADY FOUND (DO NOT REPEAT THESE):`,
                exclusionList,
                `
SEARCH SCOPE — dig deeper into ALL channels:`,
                `1. Meta Ads Library: Look for older or less-obvious ad formats`,
                `2. TikTok Ads: Sponsored content, hashtag challenges`,
                `3. Google Display / Shopping ads`,
                `4. Instagram Stories or Reels ads`,
                `5. TikTok organic viral content`,
                `6. YouTube pre-roll or bumper ads`,
                `7. Pinterest promoted pins`,
                `8. Influencer collaboration formats`,
                `
IMPORTANT: You must find creatives that differ in BOTH format AND hook strategy from the exclusion list above. If you genuinely cannot find additional DISTINCT creatives, return an empty JSON array [].`,
                `
For each NEW creative pattern return ALL fields:`,
                `- creativeName: string (must NOT match any name in the exclusion list)`,
                `- creativeType: "ugc_video" | "flat_lay" | "comparison" | "asmr" | "lifestyle" | "carousel" | "testimonial"`,
                `- description: string (what makes it effective, how it differs from existing ones)`,
                `- estimatedPerformance: { hookRate: string, engagement: string, format: string }`,
                `- reproductionPrompt: string (Fal.ai prompt — describe SCENE/ENVIRONMENT only for ${storeAnalysis.storeName ?? "the brand"}, never mention "a product" directly)`,
                `- aspectRatio: "9:16" | "1:1" | "16:9" | "4:5"`,
                `- sourceLabel: "cloned_from_competitor"`,
                `- sourceUrl: string | null (DIRECT URL to the specific post/ad. null if not found)`,
                `- sourceImageUrl: string | null (direct URL to image/thumbnail. null if not found)`,
                `- sourcePlatform: "meta_ads" | "tiktok_ads" | "google_ads" | "instagram_organic" | "tiktok_organic" | "facebook_organic" | "youtube"`,
                `
For ugc_video also include ugcScript: string (HOOK 0-3s, BODY 3-18s, CTA 18-22s with camera directions)`,
                `
Generate 1-3 NEW and DISTINCT creatives only. Return ONLY a JSON array (empty [] if nothing new found).`,
                `
LANGUAGE: Marketing copy (headlines, CTAs, overlay text), ugcScript, creativeName in ${langLabel}. Scene descriptions in English.`,
            ].join("\n");

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
                    `[spy/expand-creatives] Failed for competitor ${competitor.competitorName}`,
                );
                broadcast(userId, {
                    type: "expand_failed",
                    competitorId: competitor.id,
                    competitorName: competitor.competitorName,
                });
                continue;
            }

            if (!Array.isArray(blueprintsRaw) || blueprintsRaw.length === 0) {
                broadcast(userId, {
                    type: "expand_empty",
                    competitorId: competitor.id,
                    competitorName: competitor.competitorName,
                });
                continue;
            }

            // Deduplicate against existing names (case-insensitive)
            const existingNames = new Set(
                existingBlueprints.map((b) => b.creativeName.toLowerCase()),
            );
            const distinctRaw = blueprintsRaw.filter(
                (b) => !existingNames.has((b.creativeName ?? "").toLowerCase()),
            );

            if (distinctRaw.length === 0) {
                broadcast(userId, {
                    type: "expand_empty",
                    competitorId: competitor.id,
                    competitorName: competitor.competitorName,
                });
                continue;
            }

            const created = await Promise.all(
                distinctRaw.map((b) =>
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
                type: "expand_done",
                competitorId: competitor.id,
                competitorName: competitor.competitorName,
                count: created.length,
            });
        }

        return NextResponse.json({ status: "done", blueprints: allBlueprints });
    } catch (err) {
        console.error("[spy/expand-creatives]", err);
        return NextResponse.json({ status: "failed", error: "internal_error" }, { status: 500 });
    }
}
