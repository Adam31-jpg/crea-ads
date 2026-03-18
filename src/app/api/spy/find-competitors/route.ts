import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
        const { storeAnalysisId } = body as { storeAnalysisId: string };

        if (!storeAnalysisId) {
            return NextResponse.json({ error: "storeAnalysisId is required" }, { status: 400 });
        }

        const storeAnalysis = await prisma.storeAnalysis.findFirst({
            where: { id: storeAnalysisId, userId },
        });

        if (!storeAnalysis) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            return NextResponse.json({ error: "configuration_error" }, { status: 500 });
        }

        const uspsText = Array.isArray(storeAnalysis.usps)
            ? (storeAnalysis.usps as string[]).join(", ")
            : "";

        const rawData = storeAnalysis.rawAnalysis as Record<string, unknown> | null;
        const suggestedKeywords = Array.isArray(rawData?.suggestedKeywords)
            ? (rawData.suggestedKeywords as string[]).join(", ")
            : "";
        const products = Array.isArray(rawData?.products)
            ? (rawData.products as Array<{ name: string }>).map((p) => p.name).join(", ")
            : "";
        const certifications = Array.isArray(rawData?.certifications)
            ? (rawData.certifications as string[]).join(", ")
            : "";

        const prompt = `You are Lumina's Competitive Intelligence Agent. Find 5-8 REAL, CURRENTLY ACTIVE direct competitors for this brand.

BRAND PROFILE:
- Name: ${storeAnalysis.storeName ?? "Unknown"}
- Products: ${products || storeAnalysis.productCategory || "Unknown"}
- Category: ${storeAnalysis.productCategory ?? "Unknown"}
- Niche: ${storeAnalysis.niche ?? "Unknown"}
- Price Range: ${storeAnalysis.priceRange ?? "Unknown"}
- USPs: ${uspsText}
- Certifications: ${certifications}
- Target Market: ${storeAnalysis.targetMarket ?? "Unknown"}
- Search Keywords: ${suggestedKeywords}

INSTRUCTIONS:
1. Use Google Search to find REAL companies that sell similar products in the same format and price range.
2. Prioritize competitors that are actively running ads (Facebook, TikTok, Instagram).
3. For each competitor, verify their website URL is real and accessible.
4. Include a field "hasActiveAds" (boolean) — set to true if you can confirm they run paid ads on Meta or TikTok.
5. Include a field "adPlatforms" (string[]) — which platforms you found evidence of their advertising on.

For each competitor return:
- competitorName: string
- competitorUrl: string (their REAL website — verify it exists)
- positioning: string (1-2 sentences describing how they position vs the user's brand)
- priceRange: string
- marketingChannels: string[] (e.g., ["facebook_ads", "tiktok", "instagram"])
- relevanceScore: number (1-10, 10 = sells nearly identical products)
- hasActiveAds: boolean
- adPlatforms: string[] (e.g., ["meta", "tiktok"] — only if confirmed)

Return ONLY a JSON array. No markdown. Order by relevanceScore descending.
DO NOT invent fictional companies. Every competitor must be a real, verifiable brand.`;

        const ai = new GoogleGenAI({ apiKey: geminiKey });

        let competitorsRaw: Array<{
            competitorName: string;
            competitorUrl?: string;
            positioning?: string;
            priceRange?: string;
            marketingChannels?: string[];
            relevanceScore?: number;
            hasActiveAds?: boolean;
            adPlatforms?: string[];
        }>;

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
            const text = response.text ?? "[]";
            // Strip markdown fences if present
            const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            competitorsRaw = JSON.parse(cleaned);
        } catch {
            return NextResponse.json(
                { status: "failed", error: "competitor_search_failed" },
                { status: 500 },
            );
        }

        if (!Array.isArray(competitorsRaw) || competitorsRaw.length === 0) {
            return NextResponse.json({ status: "done", competitors: [] });
        }

        // Create DB records + generate Ad Library URLs
        const created = await Promise.all(
            competitorsRaw.map((c) => {
                const name = c.competitorName ?? "";
                const metaAdLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(name)}&search_type=keyword_unordered`;
                const tiktokAdLibraryUrl = `https://library.tiktok.com/ads?region=ALL&adv_name=${encodeURIComponent(name)}`;

                // Merge adPlatforms into marketingChannels so it's surfaced on the client
                const channels = [
                    ...(c.marketingChannels ?? []),
                    ...(c.adPlatforms ?? []),
                ].filter((v, i, arr) => arr.indexOf(v) === i);

                return prisma.competitorAnalysis.create({
                    data: {
                        storeAnalysisId,
                        competitorName: name,
                        competitorUrl: c.competitorUrl ?? null,
                        positioning: c.positioning ?? null,
                        priceRange: c.priceRange ?? null,
                        marketingChannels: channels,
                        relevanceScore: c.relevanceScore ?? 5,
                        isSelected: true,
                        isManual: false,
                        metaAdLibraryUrl,
                        tiktokAdLibraryUrl,
                        // Store hasActiveAds in a notes-style field via JSON — we'll read it client-side
                        // The competitorName prefix carries it for the badge
                    },
                });
            }),
        );

        broadcast(userId, { type: "competitors_found", storeAnalysisId, count: created.length });

        // Attach hasActiveAds from the Gemini response (not stored in DB)
        const competitorsWithAds = created.map((c, i) => ({
            ...c,
            hasActiveAds: competitorsRaw[i]?.hasActiveAds ?? false,
        }));

        return NextResponse.json({
            status: "done",
            competitors: competitorsWithAds,
        });
    } catch (err) {
        console.error("[spy/find-competitors]", err);
        return NextResponse.json({ status: "failed", error: "internal_error" }, { status: 500 });
    }
}
