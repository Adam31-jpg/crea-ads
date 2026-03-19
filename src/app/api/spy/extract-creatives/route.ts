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
                "",
                "CRITICAL — SOURCE URLs: For each creative, you MUST try to provide real URLs:",
                "1. sourceUrl — Try these in order:",
                `   a) Search "${competitor.competitorName} facebook ads library" → if found, construct: https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(competitor.competitorName ?? "")}`,
                `   b) Search "${competitor.competitorName} instagram" → if found, use: https://www.instagram.com/[username]/`,
                `   c) Search "${competitor.competitorName} tiktok" → if found, use: https://www.tiktok.com/@[username]`,
                `   d) Use their website URL as last resort: ${competitor.competitorUrl ?? ""}`,
                "   NEVER return null for sourceUrl if the competitor has any web presence.",
                "2. sourceImageUrl — Try these in order:",
                "   a) If you found a specific Instagram post URL, include the image URL if accessible",
                `   b) Search Google Images for "${competitor.competitorName} ad creative" or "${competitor.competitorName} product"`,
                "   c) Check the competitor's website for product images — look for og:image meta tags",
                "   d) If the competitor has a Shopify/WooCommerce store, product images are at predictable URLs",
                "   If you truly cannot find any image URL, return null — but TRY.",
                '- sourceImageUrl: string | null (direct URL to image/thumbnail. null if not found)',
                '- sourcePlatform: "meta_ads" | "tiktok_ads" | "google_ads" | "instagram_organic" | "tiktok_organic" | "facebook_organic" | "youtube" — ALWAYS set based on where your creative inspiration came from.',
                "",
                "For ugc_video also include ugcScript: string (HOOK 0-3s, BODY 3-18s, CTA 18-22s with camera directions)",
                "",
                "Generate 2-4 creatives. Return ONLY a JSON array. If no specific ads found, generate from niche trends, set sourceLabel to \"market_trend\" and sourceUrl to the competitor's main website.",
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

                // Debug: log what Gemini returned for each creative
                console.log(`[spy/extract-creatives] ── Competitor: ${competitor.competitorName} ──`);
                blueprintsRaw.forEach((b, i) => {
                    console.log(`  [${i}] "${b.creativeName}" type=${b.creativeType}`);
                    console.log(`       sourceUrl=${b.sourceUrl ?? "NULL"}`);
                    console.log(`       sourceImageUrl=${b.sourceImageUrl ?? "NULL"}`);
                    console.log(`       sourcePlatform=${b.sourcePlatform ?? "NULL"}`);
                });
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

            // FIX 3: Override sourceUrl with reliable Ad Library search URLs based on sourcePlatform
            // Gemini cannot reliably return working ad-specific URLs — use searchable library URLs instead
            const competitorName = competitor.competitorName ?? "";
            const productCategory = storeAnalysis.productCategory ?? "";
            for (const b of blueprintsRaw) {
                const platform = b.sourcePlatform ?? "";
                let adLibraryUrl: string | null = null;
                if (platform === "meta_ads" || platform === "facebook_organic" || platform === "instagram_organic") {
                    adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(competitorName)}&search_type=keyword_unordered`;
                } else if (platform === "tiktok_ads" || platform === "tiktok_organic") {
                    adLibraryUrl = `https://library.tiktok.com/ads?region=ALL&adv_name=${encodeURIComponent(competitorName)}`;
                } else if (platform === "google_ads") {
                    adLibraryUrl = `https://adstransparency.google.com/?region=anywhere&hl=fr&q=${encodeURIComponent(competitorName)}`;
                } else if (platform === "youtube") {
                    adLibraryUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${competitorName} ${productCategory} ad`)}`;
                }
                if (adLibraryUrl) {
                    b.sourceUrl = adLibraryUrl;
                }
            }

            // FIX 3b: Fetch og:image ONCE from competitor's actual website (not ad library URLs)
            let competitorOgImage: string | null = null;
            if (competitor.competitorUrl) {
                try {
                    const pageRes = await fetch(competitor.competitorUrl, {
                        headers: { "User-Agent": "Mozilla/5.0 (compatible; Lumina/1.0)" },
                        signal: AbortSignal.timeout(5000),
                    });
                    if (pageRes.ok) {
                        const html = await pageRes.text();
                        const ogMatch =
                            html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                            html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
                        if (ogMatch?.[1]) {
                            competitorOgImage = ogMatch[1];
                            console.log(`  [og:image] Found for ${competitor.competitorName}: ${competitorOgImage}`);
                        }
                    }
                } catch {
                    // Silent — no og:image available
                }
            }

            // Apply competitor og:image to all blueprints missing a sourceImageUrl
            for (const b of blueprintsRaw) {
                if (!b.sourceImageUrl && competitorOgImage) {
                    b.sourceImageUrl = competitorOgImage;
                }
            }

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
            // FIX 1: Stream full blueprints via SSE so the UI updates incrementally
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
