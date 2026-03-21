import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import { broadcast } from "@/lib/sse";
import { SPARK_PRICING } from "@/config/spark-pricing";
import { getExpandAds } from "@/lib/scrapecreators";

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
            targetLanguage = "fr",
        } = body as {
            storeAnalysisId: string;
            competitorIds: string[];
            existingBlueprintIds?: string[];
            targetLanguage?: string;
        };

        const langNames: Record<string, string> = {
            fr: "French", en: "English", de: "German", es: "Spanish", it: "Italian",
        };
        const langLabel = langNames[targetLanguage] ?? "French";

        if (!storeAnalysisId || !Array.isArray(competitorIds) || competitorIds.length === 0) {
            return NextResponse.json({ error: "storeAnalysisId and competitorIds are required" }, { status: 400 });
        }

        // ── Deduct sparks FIRST ───────────────────────────────────────────────
        const sparkCost = SPARK_PRICING.EXPAND_ANALYSIS;
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
        if ((user?.credits ?? 0) < sparkCost) {
            return NextResponse.json({ error: "insufficient_sparks" }, { status: 402 });
        }
        await prisma.user.update({ where: { id: userId }, data: { credits: { decrement: sparkCost } } });

        const storeAnalysis = await prisma.storeAnalysis.findFirst({ where: { id: storeAnalysisId, userId } });
        if (!storeAnalysis) return NextResponse.json({ error: "not_found" }, { status: 404 });

        // ── Build exclusion sets from existing blueprints ─────────────────────
        const existingBlueprints = await prisma.creativeBlueprint.findMany({
            where: { storeAnalysisId },
            select: { sourceImageUrl: true, creativeName: true },
        });

        const existingImageUrls = new Set<string>(
            existingBlueprints.map((b) => b.sourceImageUrl).filter(Boolean) as string[],
        );
        const existingNames = new Set(existingBlueprints.map((b) => b.creativeName.toLowerCase()));

        const competitors = await prisma.competitorAnalysis.findMany({
            where: { id: { in: competitorIds }, storeAnalysisId },
        });

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) return NextResponse.json({ error: "configuration_error" }, { status: 500 });

        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const allBlueprints: object[] = [];

        for (const competitor of competitors) {
            broadcast(userId, { type: "expand_searching", competitorId: competitor.id, competitorName: competitor.competitorName });

            // ── STEP A: Get DIFFERENT real ads (exclude already-seen images) ──
            const expandAds = await getExpandAds(competitor.competitorName ?? "", existingImageUrls, 5);
            console.log(`[spy/expand-creatives] ${expandAds.length} new ads for ${competitor.competitorName}`);

            const adsWithImages = expandAds.filter((ad) => ad.snapshotUrl);
            if (adsWithImages.length === 0) {
                broadcast(userId, { type: "expand_empty", competitorId: competitor.id, competitorName: competitor.competitorName });
                continue;
            }

            // ── STEP B: Build multimodal Gemini prompt ────────────────────────
            const realAdsContext = adsWithImages
                .map((ad, i) =>
                    `New Ad #${i + 1} (id: ${ad.adArchiveId}):\n` +
                    `  Title: ${ad.adTitle ?? "N/A"}\n` +
                    `  Text: ${ad.adText ?? "N/A"}\n` +
                    `  CTA: ${ad.ctaText ?? "N/A"}\n` +
                    `  Image URL: ${ad.snapshotUrl}\n` +
                    `  Ad Library: ${ad.sourceUrl ?? "N/A"}`,
                ).join("\n\n");

            const promptText = [
                `You are Lumina's Ad Creative Analyst performing an EXPANSION search for ${competitor.competitorName}.`,
                `These are ADDITIONAL ads not previously seen:`,
                realAdsContext,
                ``,
                `For each new ad, create a blueprint for ${storeAnalysis.storeName ?? "the brand"}:`,
                `- creativeName: string (unique name in ${langLabel})`,
                `- creativeType: "ugc_video" | "flat_lay" | "comparison" | "asmr" | "lifestyle" | "carousel" | "testimonial"`,
                `- description: string (why this format is effective)`,
                `- estimatedPerformance: { hookRate: string, engagement: string, format: string }`,
                `- reproductionPrompt: string (CRITICAL: Look at the actual ad image. Describe the LAYOUT, COMPOSITION, LIGHTING — replace the competitor's product with "${storeAnalysis.storeName ?? "the brand"} ${storeAnalysis.productCategory ?? "products"}". NEVER mention the competitor's brand. English only.)`,
                `- aspectRatio: "9:16" | "1:1" | "16:9" | "4:5"`,
                `- sourceLabel: "cloned_from_competitor"`,
                `- realAdIndex: number (0-based)`,
                ``,
                `Generate ${adsWithImages.length} blueprints. Return ONLY a JSON array.`,
                `LANGUAGE: creativeName, description, estimatedPerformance in ${langLabel}. reproductionPrompt in English.`,
            ].join("\n");

            type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
            const parts: GeminiPart[] = [{ text: promptText }];

            // Fetch images as base64 for multimodal context
            await Promise.all(
                adsWithImages.map(async (ad, i) => {
                    if (!ad.snapshotUrl) return;
                    try {
                        const imgRes = await fetch(ad.snapshotUrl, { signal: AbortSignal.timeout(5000) });
                        if (imgRes.ok) {
                            const buffer = await imgRes.arrayBuffer();
                            const base64 = Buffer.from(buffer).toString("base64");
                            const mimeType = (imgRes.headers.get("content-type") ?? "image/jpeg").split(";")[0];
                            parts.push({ text: `\n[Image for New Ad #${i + 1}]:` });
                            parts.push({ inlineData: { mimeType, data: base64 } });
                        }
                    } catch { /* best-effort */ }
                }),
            );

            let blueprintsRaw: Array<{
                creativeName: string; creativeType: string; description: string;
                estimatedPerformance?: object; reproductionPrompt: string; ugcScript?: string;
                aspectRatio?: string; sourceLabel?: string; realAdIndex?: number;
            }> = [];

            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts }],
                });
                const text = response.text ?? "[]";
                blueprintsRaw = JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
            } catch {
                console.error(`[spy/expand-creatives] Gemini failed for ${competitor.competitorName}`);
                broadcast(userId, { type: "expand_failed", competitorId: competitor.id, competitorName: competitor.competitorName });
                continue;
            }

            if (!Array.isArray(blueprintsRaw) || blueprintsRaw.length === 0) {
                broadcast(userId, { type: "expand_empty", competitorId: competitor.id, competitorName: competitor.competitorName });
                continue;
            }

            // ── STEP C: Quality gate — only blueprints with real images ───────
            const qualified: Array<{
                creativeName: string; creativeType: string; description: string;
                estimatedPerformance?: object; reproductionPrompt: string; ugcScript?: string;
                aspectRatio?: string; sourceLabel?: string;
                sourceUrl?: string | null; sourceImageUrl?: string | null; sourcePlatform?: string | null;
            }> = [];

            for (const b of blueprintsRaw) {
                const adIndex = b.realAdIndex ?? -1;
                if (adIndex >= 0 && adIndex < adsWithImages.length) {
                    const realAd = adsWithImages[adIndex];
                    const bNameLower = (b.creativeName ?? "").toLowerCase();
                    if (realAd.snapshotUrl && !existingNames.has(bNameLower)) {
                        qualified.push({
                            ...b,
                            sourceImageUrl: realAd.snapshotUrl,
                            sourceUrl: realAd.sourceUrl ?? `https://www.facebook.com/ads/library/?id=${realAd.adArchiveId}`,
                            sourcePlatform: realAd.platform === "instagram" ? "instagram_organic" : "meta_ads",
                        });
                        existingImageUrls.add(realAd.snapshotUrl);
                        existingNames.add(bNameLower);
                    }
                }
            }

            if (qualified.length === 0) continue;

            const created = await Promise.all(
                qualified.map((b) =>
                    prisma.creativeBlueprint.create({
                        data: {
                            competitorAnalysisId: competitor.id,
                            storeAnalysisId,
                            creativeName: b.creativeName ?? "Untitled",
                            creativeType: b.creativeType ?? "lifestyle",
                            description: b.description ?? "",
                            estimatedPerformance: b.estimatedPerformance
                                ? (b.estimatedPerformance as unknown as Prisma.InputJsonValue)
                                : undefined,
                            reproductionPrompt: b.reproductionPrompt ?? "",
                            ugcScript: typeof b.ugcScript === "string" ? b.ugcScript
                                : b.ugcScript ? JSON.stringify(b.ugcScript, null, 2) : null,
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
                blueprints: created,
            });
        }

        return NextResponse.json({ status: "done", blueprints: allBlueprints });
    } catch (err) {
        console.error("[spy/expand-creatives]", err);
        return NextResponse.json({ status: "failed", error: "internal_error" }, { status: 500 });
    }
}
