import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import { broadcast } from "@/lib/sse";
import { getCompetitorAds } from "@/lib/scrapecreators";

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
            // ── STEP A: Get real ads from Meta Ad Library via ScrapeCreators ──
            const realAds = await getCompetitorAds(
                competitor.competitorName ?? "",
                5,
            );
            console.log(
                `[spy/extract-creatives] ScrapeCreators returned ${realAds.length} real ads for ${competitor.competitorName}`,
            );

            // Build context for Gemini from real ad data
            const realAdsContext =
                realAds.length > 0
                    ? realAds
                          .map(
                              (ad, i) =>
                                  `Real Ad #${i + 1}:\n` +
                                  `  Title: ${ad.adTitle ?? "N/A"}\n` +
                                  `  Text: ${ad.adText ?? "N/A"}\n` +
                                  `  CTA: ${ad.ctaText ?? "N/A"}\n` +
                                  `  Platform: ${ad.platform ?? "N/A"}\n` +
                                  `  Landing: ${ad.linkUrl ?? "N/A"}\n` +
                                  `  Has image: ${ad.snapshotUrl ? "YES" : "NO"}`,
                          )
                          .join("\n\n")
                    : "No real ads found. Generate creative concepts based on the competitor's website and niche trends.";

            // ── STEP B: Build the Gemini prompt ──────────────────────────────
            const lines = [
                `You are Lumina's Ad Creative Analyst. Based on REAL ADS from ${competitor.competitorName} (${competitor.competitorUrl ?? ""}), generate reproduction blueprints.`,
                "",
                "REAL ADS FROM THE COMPETITOR (from Meta Ad Library):",
                realAdsContext,
                "",
                `For EACH real ad above (or inspired by their style if no ads found), create a blueprint for ${storeAnalysis.storeName ?? "the brand"}:`,
                "- creativeName: string (catchy name in target language)",
                '- creativeType: "ugc_video" | "flat_lay" | "comparison" | "asmr" | "lifestyle" | "carousel" | "testimonial"',
                "- description: string (what makes the original ad effective, visual style, hook strategy)",
                '- estimatedPerformance: { hookRate: string, engagement: string, format: string }',
                `- reproductionPrompt: string (Fal.ai image prompt — describe the SCENE to reproduce this ad's style for ${storeAnalysis.storeName ?? "the brand"}, never mention "a product" directly, describe environment/mood/lighting/composition in English)`,
                '- aspectRatio: "9:16" | "1:1" | "16:9" | "4:5"',
                '- sourceLabel: "cloned_from_competitor"',
                "- realAdIndex: number (0-based index matching the real ad above, or -1 if inspired by trends rather than a specific ad)",
                "",
                "For ugc_video also include ugcScript: string (HOOK 0-3s, BODY 3-18s, CTA 18-22s with camera directions)",
                "",
                `Generate ${Math.max(realAds.length, 2)} blueprints. Match real ads 1-to-1 when possible (use realAdIndex).`,
                "If no real ads were found, generate 2-3 blueprints based on niche trends and set realAdIndex to -1.",
                "Return ONLY a JSON array, no markdown fences.",
                "",
                `LANGUAGE: creativeName, description, ugcScript, estimatedPerformance values in ${langLabel}. reproductionPrompt ALWAYS in English.`,
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
                realAdIndex?: number;
            }> = [];

            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    // No googleSearch needed — we already have the real ad data
                });
                const text = response.text ?? "[]";
                const cleaned = text
                    .replace(/```json\n?/g, "")
                    .replace(/```\n?/g, "")
                    .trim();
                blueprintsRaw = JSON.parse(cleaned);

                console.log(
                    `[spy/extract-creatives] ── Competitor: ${competitor.competitorName} ── ${blueprintsRaw.length} blueprints`,
                );
            } catch {
                console.error(
                    `[spy/extract-creatives] Gemini failed for ${competitor.competitorName}`,
                );
                broadcast(userId, {
                    type: "creative_extraction_failed",
                    competitorId: competitor.id,
                    competitorName: competitor.competitorName,
                });
                continue;
            }

            if (!Array.isArray(blueprintsRaw)) continue;

            // ── STEP C: Map real ad snapshots to blueprints ───────────────────
            for (const b of blueprintsRaw) {
                const adIndex = (b.realAdIndex ?? -1);

                if (adIndex >= 0 && adIndex < realAds.length) {
                    // 1:1 match to a real ad
                    const realAd = realAds[adIndex];
                    b.sourceImageUrl = realAd.snapshotUrl;
                    b.sourceUrl = `https://www.facebook.com/ads/library/?id=${realAd.adArchiveId}`;
                    b.sourcePlatform =
                        realAd.platform === "instagram" ? "instagram_organic" : "meta_ads";
                    console.log(
                        `  [${adIndex}] "${b.creativeName}" → snapshot=${realAd.snapshotUrl ? "✓" : "✗"}`,
                    );
                } else {
                    // Trend-inspired — Ad Library search URL as fallback
                    b.sourceUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(competitor.competitorName ?? "")}&search_type=keyword_unordered`;
                    b.sourceImageUrl = null;
                    b.sourcePlatform = "meta_ads";
                }
            }

            // ── STEP D: Persist to DB ────────────────────────────────────────
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
                            ugcScript:
                                typeof b.ugcScript === "string"
                                    ? b.ugcScript
                                    : b.ugcScript
                                      ? JSON.stringify(b.ugcScript, null, 2)
                                      : null,
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

            // ── STEP E: Stream blueprints to frontend via SSE ─────────────────
            broadcast(userId, {
                type: "creatives_extracted",
                competitorId: competitor.id,
                competitorName: competitor.competitorName,
                count: created.length,
                blueprints: created,
            });
        }

        return NextResponse.json({ status: "done", blueprints: allBlueprints });
    } catch (err) {
        console.error("[spy/extract-creatives]", err);
        return NextResponse.json({ status: "failed", error: "internal_error" }, { status: 500 });
    }
}
