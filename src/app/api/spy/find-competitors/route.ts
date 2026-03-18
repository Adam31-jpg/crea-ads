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

        const prompt = `You are Lumina's Competitive Intelligence Agent. Based on this product profile, identify 5-8 direct competitors.
Product: ${storeAnalysis.storeName ?? "Unknown"} — ${storeAnalysis.productCategory ?? "Unknown"} — ${storeAnalysis.niche ?? "Unknown"} — ${storeAnalysis.priceRange ?? "Unknown"}
USPs: ${uspsText}
Target: ${storeAnalysis.targetMarket ?? "Unknown"}
For each competitor return:
- competitorName: string
- competitorUrl: string (their website)
- positioning: string (1 sentence)
- priceRange: string
- marketingChannels: string[] (e.g., ["facebook_ads", "tiktok", "instagram", "google_ads"])
- relevanceScore: number (1-10, 10 = most direct competitor)
Return ONLY a JSON array. No markdown. Order by relevanceScore descending.
Use Google Search to find real, current competitors. Do not make up companies.`;

        const ai = new GoogleGenAI({ apiKey: geminiKey });

        let competitorsRaw: Array<{
            competitorName: string;
            competitorUrl?: string;
            positioning?: string;
            priceRange?: string;
            marketingChannels?: string[];
            relevanceScore?: number;
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

                return prisma.competitorAnalysis.create({
                    data: {
                        storeAnalysisId,
                        competitorName: name,
                        competitorUrl: c.competitorUrl ?? null,
                        positioning: c.positioning ?? null,
                        priceRange: c.priceRange ?? null,
                        marketingChannels: c.marketingChannels ?? [],
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

        return NextResponse.json({
            status: "done",
            competitors: created,
        });
    } catch (err) {
        console.error("[spy/find-competitors]", err);
        return NextResponse.json({ status: "failed", error: "internal_error" }, { status: 500 });
    }
}
