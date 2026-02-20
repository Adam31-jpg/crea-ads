import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const SYSTEM_PROMPT = `You are Lumina's AI Creative Director — an expert performance marketer and art director.

Given a product's description, top 3 USPs, and target audience, you MUST generate exactly 10 ad concepts following the AIDA & PAS marketing frameworks:

**Output Structure (JSON array of 10 objects):**

Concepts 1-4: AIDA Framework (Attention → Interest → Desire → Action)
Concepts 5-8: PAS Framework (Problem → Agitation → Solution)
Concepts 9-10: VIDEO concepts (motion ads, 6 seconds, high-energy)

Each concept MUST have:
- "index": number (0-9)
- "type": "image" (0-7) or "video" (8-9)
- "framework": "AIDA" or "PAS" or "VIDEO"
- "headline": string (max 60 chars, punchy, conversion-focused)
- "subheadline": string (max 80 chars)
- "cta": string (max 30 chars, e.g. "Shop Now", "Try Free")
- "visualDirection": string (describe the composition, colors, mood in 1-2 sentences)
- "colorMood": one of "sunset", "midnight", "studio_white", "electric_neon"
- "emphasis": one of "product_detail", "typography_heavy", "balanced"

Rules:
- Headlines MUST be punchy, emotional, conversion-driven
- Each concept MUST feel unique — vary angles, tones, and hooks
- Video concepts (index 8-9) should have dynamic, motion-oriented visual directions
- Return ONLY a JSON array, no markdown fences, no explanation`;

export async function POST(req: NextRequest) {
    // Auth
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!GEMINI_API_KEY) {
        return NextResponse.json(
            { error: "GEMINI_API_KEY not configured" },
            { status: 500 }
        );
    }

    const { productDescription, usps, targetAudience } = await req.json();

    if (!productDescription || !usps || !targetAudience) {
        return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 }
        );
    }

    const userPrompt = `
**Product Description:** ${productDescription}

**Top 3 USPs:**
1. ${usps[0] || "N/A"}
2. ${usps[1] || "N/A"}
3. ${usps[2] || "N/A"}

**Target Audience:** ${targetAudience}

Generate 10 ad concepts as a JSON array.`;

    try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: userPrompt,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 1.0,
                maxOutputTokens: 4096,
            },
        });

        const text = response.text ?? "";

        // Parse JSON — strip markdown fences if present
        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const concepts = JSON.parse(cleaned);

        if (!Array.isArray(concepts) || concepts.length !== 10) {
            return NextResponse.json(
                { error: "AI returned invalid format. Expected 10 concepts." },
                { status: 500 }
            );
        }

        return NextResponse.json({ concepts });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Gemini API error";
        console.error("[Strategy API]", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
