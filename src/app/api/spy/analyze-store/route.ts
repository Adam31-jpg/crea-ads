import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { GoogleGenAI } from "@google/genai";
import { broadcast } from "@/lib/sse";

const SYSTEM_PROMPT = `You are Lumina's Expert E-Commerce Store Analyst. You must perform an EXHAUSTIVE analysis of the store HTML provided. Do NOT give shallow or generic answers. Dig deep into every detail you can extract.

MANDATORY OUTPUT — Return ONLY valid JSON with ALL of these fields filled (never null unless truly impossible):

{
  "storeName": "string — the brand name, extracted from title tag, logo alt text, or header",
  "productCategory": "string — be VERY specific. Not just 'supplements' but 'sublingual oral dissolving wellness strips' or 'collagen peptide powder sachets'. Describe the exact product format.",
  "niche": "string — the precise market niche. Not 'health' but 'DTC sublingual supplement strips targeting wellness-conscious Europeans'. Be as specific as possible.",
  "priceRange": "string — extract actual prices from the HTML. Format: '€32.50 - €39.90' or '$24.99 - $49.99'. Look for price elements, sale prices, original prices.",
  "usps": ["string array — extract 5-8 SPECIFIC selling points from the page content. Look for: benefit claims, certifications (vegan, GMP, lab-tested), speed claims (dissolves in 5 seconds), comparison claims (3x faster absorption), ingredient highlights, guarantees (30-day money back), shipping promises. NEVER return an empty array. If you can't find explicit USPs, infer them from product descriptions."],
  "toneOfVoice": "string — analyze the copywriting style. Examples: 'premium/clinical with bold claims', 'playful/youth-oriented with emoji usage', 'luxury/minimalist with short sentences', 'scientific/authoritative with data-driven claims'. Be descriptive.",
  "targetMarket": "string — be specific about demographics. Not just 'health consumers' but 'European millennials (25-40) interested in convenient wellness supplements, likely urban professionals'. Infer from language, currency, shipping info, and content style.",
  "brandPositioning": "string — how does this brand position itself? Premium/luxury? Budget-friendly? Science-first? Natural/organic? Clinical? Describe in 1-2 sentences.",
  "productCount": "number — how many distinct products can you identify?",
  "products": [{"name": "string", "price": "string", "description": "string — brief"}],
  "certifications": ["string array — GMP, vegan, lab-tested, FDA-registered, organic, etc. Extract ALL visible certifications and trust badges."],
  "shippingInfo": "string — shipping speed, free shipping threshold, regions served",
  "socialProof": "string — review count, star rating, press mentions, 'as seen in' logos, customer count claims",
  "contentStyle": "string — describe the visual design: dark/light, minimalist/busy, photography style, color scheme",
  "suggestedKeywords": ["string array — 5-10 keywords that best describe this brand for competitor search. These will be used to find direct competitors."]
}

CRITICAL RULES:
1. Extract ACTUAL prices from the HTML — look for elements with currency symbols (€, $, £).
2. USPs must be SPECIFIC and extracted from real page content — not generic filler.
3. Products array must list real products found on the page with actual names and prices.
4. If the page mentions certifications, press logos, or review counts, ALWAYS extract them.
5. suggestedKeywords are crucial — they will drive the competitor search. Make them specific to the product category and format, not just the industry.
6. NEVER return null for usps — always infer at least 3 points from the content.
7. Analyze the ENTIRE HTML provided, not just the first few lines.

Return ONLY the JSON object. No markdown fences. No explanation text.`;

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

        // Truncate to first 30000 chars for richer context
        const truncatedHtml = html.slice(0, 30000);

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
                model: "gemini-2.5-pro",
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
