import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";
import { GENERATION_CONFIG } from "@/config/generation.config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const getSystemPrompt = (targetLanguage: string, aspectRatio: string = "9:16") => `### ROLE
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
- "background_prompt": string (REQUIRED. Describe ONLY the environment — lighting, surfaces, textures, color palette. NEVER describe any subject, person, product, bottle, object, or 3D shape. ALWAYS begin with "Empty minimalist studio" then add environmental details. Example: "Empty minimalist studio, soft gradient light, pale marble floor, 8k, photorealistic". Fallback: "Empty minimalist studio, soft neutral lighting, clean background, 8k, photorealistic".)
- "elements": array — THE VISUAL COMPOSITION. Specifies exact position of each text block inside the safe content area.
  Each element object MUST contain:
  • "id"    : unique string — use "hl" (headline), "shl" (subheadline), "cta" (call-to-action)
  • "type"  : EXACTLY one of: "headline" | "subheadline" | "cta"
  • "x"     : number 0–100 — % distance from the LEFT edge of the safe content area
  • "y"     : number 0–100 — % distance from the TOP of the safe content area
  • "width" : number 10–90 — % width of the element relative to safe area width
  • "align" : "left" | "center"  ("left" anchors at x; "center" centers the block on x)
  RULES: Do NOT add a "content" field — content is taken from "headline"/"subheadline"/"cta" above.
  ALWAYS include all three elements: "hl", "shl", "cta".

### LAYOUT GEOMETRY — Coordinate System (Format: ${aspectRatio})
The coordinate origin (0,0) is the TOP-LEFT corner of the SAFE CONTENT AREA (after platform danger zones are excluded).
x=100 is the RIGHT edge, y=100 is the BOTTOM edge of the safe content area.
The 3D product mesh is always rendered in the RIGHT half of the frame for "converter" and centered for "minimalist".

#### PORTRAIT 9:16 — Converter Layout
Product occupies the right 50% of the frame. Keep ALL elements within x ≤ 45 to avoid the product mesh.
Stack text top-to-bottom on the left column:
  hl:  { x: 5, y: 18, width: 42, align: "left" }   ← headline near top
  shl: { x: 5, y: 38, width: 42, align: "left" }   ← subheadline mid
  cta: { x: 5, y: 60, width: 38, align: "left" }   ← CTA lower third

#### PORTRAIT 9:16 — Minimalist Layout
All elements centered. Text spans the full safe width:
  hl:  { x: 50, y: 15, width: 85, align: "center" }  ← bold headline near top
  shl: { x: 50, y: 68, width: 80, align: "center" }  ← subheadline low
  cta: { x: 50, y: 83, width: 55, align: "center" }  ← CTA near bottom

#### LANDSCAPE 16:9 — Converter Layout
Product on the RIGHT 40%. Text block occupies the LEFT 55%:
  hl:  { x: 5, y: 20, width: 52, align: "left" }
  shl: { x: 5, y: 48, width: 52, align: "left" }
  cta: { x: 5, y: 70, width: 42, align: "left" }

#### LANDSCAPE 16:9 — Minimalist Layout
  hl:  { x: 50, y: 12, width: 80, align: "center" }
  shl: { x: 50, y: 55, width: 70, align: "center" }
  cta: { x: 50, y: 80, width: 40, align: "center" }

### LOGO ANTI-COLLISION — MANDATORY
When logo_position is not null, you MUST shift elements AWAY from the logo corner.
- logo "top-right"    → start headline at y ≥ 22 and keep x ≤ 70. CTA can go to y ≤ 75.
- logo "top-left"     → start headline at y ≥ 30 (clear the top-left area). Use x ≥ 8.
- logo "bottom-right" → keep CTA at y ≤ 72. Subheadline at y ≤ 58.
- logo "bottom-left"  → keep CTA at x ≥ 20, y ≤ 72.
Rule: NO element bounding box (x to x+width, y to y+20) should overlap the logo corner quadrant (a 20×20% zone in the relevant corner).

### LAYOUT VARIETY MANDATE — CRITICAL
Each of the ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} concepts MUST use a DIFFERENT vertical composition.
FORBIDDEN: Two concepts with identical y values on any element.
Choose from these distinct stacking patterns and vary between concepts:
- PATTERN A "Impact Top":  hl y=12–18, shl y=55–65, cta y=78–85   (bold hook, wide gap, bottom close)
- PATTERN B "Classic Mid": hl y=22–28, shl y=42–50, cta y=62–70   (comfortable editorial rhythm)
- PATTERN C "Bottom Push": hl y=35–45, shl y=58–65, cta y=78–88   (product-first, copy secondary)
Use PATTERN A for concept 0 and PATTERN B for concept 1 (when ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} = 2).

### FRAMEWORKS & STRATEGY
- "THE HOOK-POINT" (Stop the scroll). Focus on a massive problem or shocking benefit.
- "EMOTIONAL DESIRE" (Identity & Status). Connect the product to the user's ego.
- "THE AUTHORITY" (Social Proof/Logic). Technical superiority or scarcity.
- "REELS/TIKTOK VIBE" (High-energy). Rapid motion, UGC-style visual directions.

### STRICT RULES
1. UNIQUE HOOKS: Each concept must have a radically different marketing angle AND a different element layout.
2. NO MARKDOWN: Return ONLY the raw JSON array. No fences, no intro, no outro.
3. CONVERSION FIRST: Headlines must use power words (Secret, Ultimate, Hack, Transform).
4. VISUAL PRECISION: Specify lighting (e.g., "High-key studio lighting") and movement for videos.
5. QUALITY OVERRIDE: If the user input is "bad", your output must be "excellent".
6. LANGUAGE ENFORCEMENT: Generate all creative copy strictly in: ${targetLanguage}. Use high-converting, native-level vocabulary.
7. ELEMENTS REQUIRED: Every concept MUST include a valid "elements" array with all three types (hl, shl, cta). Missing or empty elements array is a critical failure.
8. BACKGROUND SUBJECT BAN: The "background_prompt" MUST describe only the environment (light, surface, color). It MUST start with "Empty minimalist studio". NEVER include a subject, bottle, person, product, shield, blob, orb, or any 3D object. Violating this rule causes a generation failure.`;

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

    const { productDescription, usps, targetAudience, logoUrl, targetLanguage = "Français", aspectRatio = "9:16" } = await req.json();

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
                model: GENERATION_CONFIG.AI_MODELS.STRATEGY,
                contents: userPrompt,
                config: {
                    systemInstruction: getSystemPrompt(targetLanguage, aspectRatio),
                    temperature: 0.8,
                    maxOutputTokens: 8192,
                },
            });
            text = response.text ?? "";
            if (!text) throw new Error("Empty response from Pro model");
        } catch (proErr) {
            console.warn("[Strategy API] Pro model failed, falling back to Flash", proErr);
            // Fallback to Flash if Pro is unavailable
            const fallbackResponse = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: userPrompt,
                config: {
                    systemInstruction: getSystemPrompt(targetLanguage, aspectRatio),
                    temperature: 0.8,
                    maxOutputTokens: 8192,
                },
            });
            text = fallbackResponse.text ?? "";
        }

        console.log("[Strategy API] Raw Gemini response:", text);

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
