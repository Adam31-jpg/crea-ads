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
            const realAds = await getCompetitorAds(competitor.competitorName ?? "", 5);
            console.log(
                `[spy/extract-creatives] ScrapeCreators returned ${realAds.length} real ads for ${competitor.competitorName}`,
            );

            // ── QUALITY GATE: Only process ads that have preview images ─────
            const adsWithImages = realAds.filter((ad) => ad.snapshotUrl);
            const skipped = realAds.length - adsWithImages.length;
            if (skipped > 0) {
                console.log(
                    `[spy/extract-creatives] Skipped ${skipped} ads without images for ${competitor.competitorName}`,
                );
            }

            if (adsWithImages.length === 0) {
                console.log(
                    `[spy/extract-creatives] No ads with images for ${competitor.competitorName} — skipping Gemini`,
                );
                broadcast(userId, {
                    type: "creative_extraction_failed",
                    competitorId: competitor.id,
                    competitorName: competitor.competitorName,
                    reason: "no_ads_with_images",
                });
                continue;
            }

            // ── Build context text for Gemini ─────────────────────────────
            const realAdsContext = adsWithImages
                .map(
                    (ad, i) =>
                        `Real Ad #${i + 1} (ad_archive_id: ${ad.adArchiveId}):\n` +
                        `  Title: ${ad.adTitle ?? "N/A"}\n` +
                        `  Text: ${ad.adText ?? "N/A"}\n` +
                        `  CTA: ${ad.ctaText ?? "N/A"}\n` +
                        `  Platform: ${ad.platform ?? "N/A"}\n` +
                        `  Landing: ${ad.linkUrl ?? "N/A"}\n` +
                        `  Image URL: ${ad.snapshotUrl}\n` +
                        `  Ad Library URL: ${ad.sourceUrl ?? "N/A"}`,
                )
                .join("\n\n");

            // ── STEP B: Build the Gemini multimodal prompt ────────────────
            const lines = [
                `You are Lumina's Ad Creative Analyst. Based on REAL ADS from ${competitor.competitorName} (${competitor.competitorUrl ?? ""}), generate reproduction blueprints.`,
                "",
                "REAL ADS FROM THE COMPETITOR (from Meta Ad Library):",
                realAdsContext,
                "",
                `For EACH real ad above, create a blueprint for ${storeAnalysis.storeName ?? "the brand"}:`,
                "- creativeName: string (catchy name in target language)",
                '- creativeType: "ugc_video" | "flat_lay" | "comparison" | "asmr" | "lifestyle" | "carousel" | "testimonial"',
                "- description: string (what makes the original ad effective, visual style, hook strategy)",
                '- estimatedPerformance: { hookRate: string, engagement: string, format: string }',
                `- reproductionPrompt: string (Describe ONLY the ad's LAYOUT and VISUAL COMPOSITION: background color/gradient/texture, lighting direction and style, text placement and font style, overall spacing and composition. Do NOT describe or mention any product, packaging, brand name, or branded item. The user's own product image will be composited separately by the image generator. Example good prompt: 'Deep navy-to-black gradient background. Bold white sans-serif headline text centered in upper third. Soft even studio lighting from above. Clean minimalist composition with empty product area centered in lower half. Small rounded CTA button bottom-right. Subtle lens flare top-left.' Example BAD prompt: 'A white Solaray powder tub on dark blue background' — NEVER describe the product. Write in English.)`,
                '- aspectRatio: "9:16" | "1:1" | "16:9" | "4:5"',
                '- sourceLabel: "cloned_from_competitor"',
                "- realAdIndex: number (0-based index matching the real ad above)",
                "",
                "For ugc_video also include ugcScript: string (HOOK 0-3s, BODY 3-18s, CTA 18-22s with camera directions)",
                "",
                `Generate exactly ${adsWithImages.length} blueprints. One per real ad above (match using realAdIndex 0-based).`,
                "Return ONLY a JSON array, no markdown fences.",
                "",
                `LANGUAGE: creativeName, description, ugcScript, estimatedPerformance values in ${langLabel}. reproductionPrompt ALWAYS in English.`,
            ];
            const promptText = lines.join("\n");

            // ── Fetch ad images as base64 for multimodal context ──────────
            type GeminiPart =
                | { text: string }
                | { inlineData: { mimeType: string; data: string } };

            const parts: GeminiPart[] = [{ text: promptText }];

            await Promise.all(
                adsWithImages.map(async (ad, i) => {
                    if (!ad.snapshotUrl) return;
                    try {
                        const imgRes = await fetch(ad.snapshotUrl, {
                            signal: AbortSignal.timeout(5000),
                        });
                        if (imgRes.ok) {
                            const buffer = await imgRes.arrayBuffer();
                            const base64 = Buffer.from(buffer).toString("base64");
                            const mimeType =
                                (imgRes.headers.get("content-type") ?? "image/jpeg").split(";")[0];
                            parts.push({ text: `\n[Image for Real Ad #${i + 1}]:` });
                            parts.push({ inlineData: { mimeType, data: base64 } });
                        }
                    } catch {
                        // Image fetch failed — Gemini will rely on text description only
                        console.warn(
                            `[spy/extract-creatives] Could not fetch image for ad ${ad.adArchiveId}`,
                        );
                    }
                }),
            );

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
                    contents: [{ role: "user", parts }],
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

            // ── STEP C: Map real ad snapshots — QUALITY GATE ──────────────
            // Only blueprints with a real image make it through.
            const qualifiedBlueprints: typeof blueprintsRaw = [];

            for (const b of blueprintsRaw) {
                const adIndex = b.realAdIndex ?? -1;

                if (adIndex >= 0 && adIndex < adsWithImages.length) {
                    const realAd = adsWithImages[adIndex];
                    b.sourceImageUrl = realAd.snapshotUrl;
                    b.sourceUrl =
                        realAd.sourceUrl ??
                        `https://www.facebook.com/ads/library/?id=${realAd.adArchiveId}`;
                    b.sourcePlatform =
                        realAd.platform === "instagram" ? "instagram_organic" : "meta_ads";

                    if (b.sourceImageUrl) {
                        qualifiedBlueprints.push(b);
                        console.log(`  [${adIndex}] "${b.creativeName}" → snapshot=✓`);
                    } else {
                        console.log(`  [${adIndex}] "${b.creativeName}" → SKIPPED (no image)`);
                    }
                }
                // Do NOT add blueprints without sourceImageUrl — quality gate is non-negotiable
            }

            if (qualifiedBlueprints.length === 0) {
                console.log(
                    `[spy/extract-creatives] All blueprints filtered out for ${competitor.competitorName}`,
                );
                continue;
            }

            // ── STEP D: Persist to DB ────────────────────────────────────
            const created = await Promise.all(
                qualifiedBlueprints.map((b) =>
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

            // ── STEP E: Stream blueprints to frontend via SSE ─────────────
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
