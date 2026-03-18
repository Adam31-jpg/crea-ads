import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import { broadcast } from "@/lib/sse";

const SYSTEM_PROMPT = `You are Lumina's Store Analyzer. Analyze this e-commerce store HTML and extract:
- storeName: string
- productCategory: string (e.g., "sublingual wellness strips", "skincare serums")
- niche: string (e.g., "DTC health supplements", "luxury fragrance")
- priceRange: string (e.g., "€30-40", "$15-25")
- usps: string[] (3-5 unique selling points detected)
- toneOfVoice: string (e.g., "premium/clinical", "playful/youth")
- targetMarket: string (e.g., "European health-conscious millennials")
Return ONLY valid JSON. No markdown fences. If you can't determine a field, use null.`;

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;

        const body = await req.json();
        const { storeUrl } = body as { storeUrl: string };

        if (!storeUrl) {
            return NextResponse.json({ error: "storeUrl is required" }, { status: 400 });
        }

        // Attempt to fetch store HTML
        let html = "";
        try {
            console.log("[spy/analyze-store] Fetching store URL:", storeUrl);
            const res = await fetch(storeUrl, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; Lumina/1.0)" },
                signal: AbortSignal.timeout(10000),
            });
            console.log("[spy/analyze-store] Fetch status:", res.status);
            if (res.ok) {
                html = await res.text();
                console.log("[spy/analyze-store] HTML length:", html.length);
            }
        } catch (fetchErr) {
            console.warn("[spy/analyze-store] Fetch failed:", fetchErr);
        }

        if (html.length < 500) {
            console.log("[spy/analyze-store] Insufficient HTML, returning manual_fallback. Length:", html.length);
            return NextResponse.json({
                status: "manual_fallback",
                error: html.length === 0 ? "fetch_failed" : "insufficient_content",
            });
        }

        // Truncate to first 15000 chars to fit Gemini context
        const truncatedHtml = html.slice(0, 15000);

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            console.error("[spy/analyze-store] GEMINI_API_KEY is not set");
            return NextResponse.json({ error: "configuration_error" }, { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey: geminiKey });

        let analysisJson: Record<string, unknown>;
        try {
            console.log("[spy/analyze-store] Calling Gemini for store analysis...");
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [
                    { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nHTML:\n${truncatedHtml}` }] },
                ],
            });
            const text = response.text ?? "";
            console.log("[spy/analyze-store] Gemini raw response length:", text.length);
            console.log("[spy/analyze-store] Gemini response preview:", text.slice(0, 200));
            // Strip markdown code fences if present
            const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
            analysisJson = JSON.parse(cleaned);
            console.log("[spy/analyze-store] Parsed analysis keys:", Object.keys(analysisJson));
        } catch (aiErr) {
            console.error("[spy/analyze-store] Gemini call or JSON parse failed:", aiErr);
            return NextResponse.json({ status: "failed", error: "ai_analysis_failed" }, { status: 500 });
        }

        console.log("[spy/analyze-store] Saving StoreAnalysis to DB for user:", userId);
        const storeAnalysis = await prisma.storeAnalysis.create({
            data: {
                userId,
                storeUrl,
                storeName: (analysisJson.storeName as string) ?? null,
                productCategory: (analysisJson.productCategory as string) ?? null,
                niche: (analysisJson.niche as string) ?? null,
                priceRange: (analysisJson.priceRange as string) ?? null,
                usps: analysisJson.usps ? (analysisJson.usps as string[]) : undefined,
                toneOfVoice: (analysisJson.toneOfVoice as string) ?? null,
                targetMarket: (analysisJson.targetMarket as string) ?? null,
                rawAnalysis: analysisJson as unknown as Prisma.InputJsonValue,
                status: "done",
            },
        });

        console.log("[spy/analyze-store] Done. storeAnalysisId:", storeAnalysis.id);
        broadcast(userId, { type: "store_analysis_done", storeAnalysisId: storeAnalysis.id });

        return NextResponse.json({
            status: "done",
            storeAnalysisId: storeAnalysis.id,
            ...analysisJson,
        });
    } catch (err) {
        console.error("[spy/analyze-store]", err);
        return NextResponse.json({ status: "failed", error: "internal_error" }, { status: 500 });
    }
}
