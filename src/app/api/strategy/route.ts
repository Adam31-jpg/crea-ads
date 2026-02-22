import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";
import { GENERATION_CONFIG } from "@/config/generation.config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const getSystemPrompt = (targetLanguage: string) => `### ROLE
You are Lumina's Elite AI Creative Director — a hybrid of a world-class performance marketer and a technical art director. Your goal is to generate ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} high-converting ad concepts for Meta, TikTok, and Google Ads.

### CORE MISSION: "VALUE INFERENCE"
If user input is poor or vague, DO NOT be generic. Use your internal knowledge to infer professional USPs, emotional triggers, and luxury positioning based on the product's niche. You must "fix" the user's bad input by providing expert-level marketing angles.

### STRUCTURE TECHNIQUE (JSON Array of ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} objects)
Generate exactly ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} concepts: ${GENERATION_CONFIG.IMAGE_COUNT} images and ${GENERATION_CONFIG.VIDEO_COUNT} videos.
Each object MUST strictly follow this schema:
- "index": number (0-${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH - 1})
- "type": "image" (0-${GENERATION_CONFIG.IMAGE_COUNT - 1}) or "video" (${GENERATION_CONFIG.IMAGE_COUNT}-${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH - 1})
- "framework": string (The specific angle used)
- "headline": string (MAX 50 chars - punchy, hook-driven, NO boring text)
- "subheadline": string (MAX 80 chars - emotional bridge to CTA)
- "cta": string (MAX 25 chars - e.g., "Get Yours Now", "Shop the Collection")
- "visualDirection": string (2 sentences: specific lighting, camera angle, and composition)
- "colorMood": "sunset" | "midnight" | "studio_white" | "electric_neon"
- "emphasis": "product_detail" | "typography_heavy" | "balanced"
- "layoutType": "converter" | "minimalist" (converter = text left & product right. minimalist = centered & minimal text)
- "logo_position": string | null (You will receive a has_logo parameter. If true, select one from: 'top-left', 'top-right', 'bottom-left', 'bottom-right'. If false, return null.)

### FRAMEWORKS & STRATEGY (Adapt and select from these hooks for your generated concepts)
- "THE HOOK-POINT" (Stop the scroll). Focus on a massive problem or shocking benefit.
- "EMOTIONAL DESIRE" (Identity & Status). Connect the product to the user's ego.
- "THE AUTHORITY" (Social Proof/Logic). Technical superiority or scarcity.
- "REELS/TIKTOK VIBE" (High-energy). Rapid motion, UGC-style visual directions.

### STRICT RULES
1. UNIQUE HOOKS: Each of the ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} concepts must have a radically different marketing angle.
2. NO MARKDOWN: Return ONLY the raw JSON array. No fences, no intro, no outro.
3. CONVERSION FIRST: Headlines must use power words (Secret, Ultimate, Hack, Transform).
4. VISUAL PRECISION: Specify lighting (e.g., "High-key studio lighting") and movement for videos.
5. QUALITY OVERRIDE: If the user input is "bad", your output must be "excellent".
6. LANGUAGE ENFORCEMENT: Generate all creative copy (Headlines, Subheadlines, CTAs) strictly in the requested target language: ${targetLanguage}. Use high-converting, native-level marketing vocabulary in that language.`;

export async function POST(req: NextRequest) {
    // Auth
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!GEMINI_API_KEY) {
        return NextResponse.json(
            { error: "noApiKey" },
            { status: 500 }
        );
    }

    const { productDescription, usps, targetAudience, logoUrl, targetLanguage = "Français" } = await req.json();

    if (!productDescription || !usps || !targetAudience) {
        return NextResponse.json(
            { error: "missingFields" },
            { status: 400 }
        );
    }

    const has_logo = !!logoUrl;

    // DEBIT-BEFORE-GEN LOGIC: Consume Sparks
    const cost = GENERATION_CONFIG.STRATEGY_SPARK_COST;
    if (cost > 0) {
        const { error: debitError } = await supabase.rpc('decrement_credits', { p_user_id: user.id, p_amount: cost });

        if (debitError) {
            console.error("[Strategy API] Debit failed:", debitError);
            return NextResponse.json(
                { error: "insufficient_funds" },
                { status: 402 } // Payment Required
            );
        }
    }

    const userPrompt = `
**Product Description:** ${productDescription}

**Top 3 USPs:**
1. ${usps[0] || "N/A"}
2. ${usps[1] || "N/A"}
3. ${usps[2] || "N/A"}

**Target Audience:** ${targetAudience}

**has_logo:** ${has_logo}

Generate ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} ad concepts as a JSON array.`;

    try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        let text = "";

        // 1. The Brain (Strategic Intelligence)
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: userPrompt,
                config: {
                    systemInstruction: getSystemPrompt(targetLanguage),
                    temperature: 0.8,
                    maxOutputTokens: 8192,
                },
            });
            text = response.text ?? "";
        } catch (proErr) {
            console.warn("[Strategy API] Pro model failed, falling back to Flash", proErr);
            // Fallback to Flash if Pro is unavailable
            const fallbackResponse = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: userPrompt,
                config: {
                    systemInstruction: getSystemPrompt(targetLanguage),
                    temperature: 0.8,
                    maxOutputTokens: 8192,
                },
            });
            text = fallbackResponse.text ?? "";
        }

        // Clean any potential markdown from the response
        let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        let concepts;

        try {
            concepts = JSON.parse(cleaned);
        } catch (parseErr) {
            console.warn("[Strategy API] JSON parsing failed from Brain, kicking in Flash Muscle to format.");
            // 2. The Muscles (Technical Formatting)
            const formatterResponse = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Extract and format the following text into a perfectly valid JSON array of ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} objects following the strict schema. Do not include markdown fences, just the raw JSON array.\n\nTEXT:\n${text}`,
                config: {
                    systemInstruction: "You are a strict JSON formatter. Your only job is to output a raw, perfectly valid JSON array. Fix any structural issues in the provided text.",
                    temperature: 0.1,
                    maxOutputTokens: 8192,
                }
            });

            text = formatterResponse.text ?? "";
            cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            concepts = JSON.parse(cleaned);
        }

        if (!Array.isArray(concepts) || concepts.length !== GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH) {
            return NextResponse.json(
                { error: "invalidFormat" },
                { status: 500 }
            );
        }

        return NextResponse.json({ concepts });
    } catch (err: unknown) {
        console.error("[Strategy API]", err);
        return NextResponse.json({ error: "connectFailed" }, { status: 500 });
    }
}
