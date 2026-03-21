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
4. hasActiveAds: Set to true ONLY if you found CONCRETE EVIDENCE of paid ads (e.g., found them in Meta Ad Library results, saw "Sponsored" posts, or found TikTok ad campaigns). If unsure, set false. It is better to say false than give a false positive.
5. adPlatforms: ONLY list platforms where you have CONFIRMED ad presence, not assumed.

IMPORTANT FOR competitorName: Use the exact name as it appears on their Facebook page.
Do NOT include parenthetical product names, legal suffixes (Inc., Ltd., LLC), or trademark symbols (®, ™).
Examples: Use "Solaray" not "Solaray (Magnesium Glycinate)". Use "Wellbeing Nutrition" not "Wellbeing Nutrition (Melts®)".
The name must match their Facebook business page name exactly.

For each competitor return:
- competitorName: string (Facebook-page-friendly, no parentheses, no ® or ™)
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
                config: { tools: [{ googleSearch: {} }] },
            });
            const text = response.text ?? "[]";
            const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            competitorsRaw = JSON.parse(cleaned);
        } catch {
            return NextResponse.json({ status: "failed", error: "competitor_search_failed" }, { status: 500 });
        }

        if (!Array.isArray(competitorsRaw) || competitorsRaw.length === 0) {
            return NextResponse.json({ status: "done", competitors: [] });
        }

        // PHASE 2: Verify each competitor — fetch site + Gemini cross-check
        const verifiedRaw: typeof competitorsRaw = [];
        let verifiedCount = 0;
        for (const competitor of competitorsRaw) {
            broadcast(userId, {
                type: "competitor_verifying",
                competitorName: competitor.competitorName,
                progress: `${verifiedCount + 1}/${competitorsRaw.length}`,
            });

            if (!competitor.competitorUrl) {
                verifiedRaw.push(competitor);
                verifiedCount++;
                continue;
            }

            let passed = true;
            try {
                const siteRes = await fetch(competitor.competitorUrl, {
                    headers: { "User-Agent": "Mozilla/5.0 (compatible; Lumina/1.0)" },
                    signal: AbortSignal.timeout(8000),
                });
                if (siteRes.ok) {
                    const siteHtml = await siteRes.text();
                    const siteText = siteHtml.slice(0, 10000);
                    const verifyPrompt =
                        `You are a verification agent. Determine if this website sells products broadly related to the user's store category.\n\n` +
                        `USER'S STORE: Name: ${storeAnalysis.storeName}, Category: ${storeAnalysis.productCategory}, Niche: ${storeAnalysis.niche}\n` +
                        `COMPETITOR: Name: ${competitor.competitorName}, URL: ${competitor.competitorUrl}\n` +
                        `COMPETITOR HTML (first 10000 chars):\n${siteText}\n\n` +
                        `Rules:\n` +
                        `- isVerified: true if the site is a real, active e-commerce or product brand (not a 404, parked domain, or pure service company)\n` +
                        `- confidence: integer 0-100 (be GENEROUS — if the site sells any products at all and the niche is plausible, score 60+)\n` +
                        `- isDirectCompetitor: true if they sell similar products\n` +
                        `Return ONLY: { "isVerified": boolean, "confidence": number, "isDirectCompetitor": boolean }`;
                    const vRes = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: [{ role: "user", parts: [{ text: verifyPrompt }] }],
                    });
                    const vText = (vRes.text ?? "{}").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                    const verification = JSON.parse(vText);
                    // Normalize confidence: Gemini may return 0-1 float or 0-100 integer
                    const rawConfidence = verification.confidence ?? 0;
                    const normalizedConfidence = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
                    passed = verification.isVerified === true && normalizedConfidence >= 50;
                    if (!passed) {
                        console.log(`[spy/find-competitors] REJECTED: ${competitor.competitorName} (raw:${rawConfidence} normalized:${normalizedConfidence})`);
                    }
                }
            } catch {
                // Network failure — keep competitor, can't verify
            }

            if (passed) verifiedRaw.push(competitor);
            verifiedCount++;
        }

        // Fallback: if verification filtered everything, keep top 5 raw results
        const finalList = verifiedRaw.length > 0 ? verifiedRaw : competitorsRaw.slice(0, 5);

        // Create DB records
        const created = await Promise.all(
            finalList.map((c) => {
                const name = c.competitorName ?? "";
                const metaAdLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(name)}&search_type=keyword_unordered`;
                const tiktokAdLibraryUrl = `https://library.tiktok.com/ads?region=ALL&adv_name=${encodeURIComponent(name)}`;
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
                    },
                });
            }),
        );

        broadcast(userId, { type: "competitors_found", storeAnalysisId, count: created.length });

        const competitorsWithAds = created.map((c, i) => ({
            ...c,
            hasActiveAds: finalList[i]?.hasActiveAds ?? false,
        }));

        return NextResponse.json({ status: "done", competitors: competitorsWithAds });
    } catch (err) {
        console.error("[spy/find-competitors]", err);
        return NextResponse.json({ status: "failed", error: "internal_error" }, { status: 500 });
    }
}
