import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const GENERATION_CONFIG = {
    TOTAL_MEDIA_PER_BATCH: 5,
    IMAGE_COUNT: 4,
    VIDEO_COUNT: 1,
};

const SYSTEM_PROMPT = `### ROLE
You are Lumina's Elite AI Creative Director — a hybrid of a world-class performance marketer, a technical art director, and a cinematic set designer. Your goal is to generate ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} high-converting ad concepts for Meta, TikTok, Instagram, and Google Ads.

### AESTHETIC VOCABULARY BY THEME
**luxe-sombre / midnight / noir:**
- Surfaces: polished obsidian shelf | black silk fabric fold | dark still water reflecting a single light | smoked glass panel | lacquered ebony wood with grain | wet black marble slab
- Lighting: single focused pin-spot with hard falloff | cool blue rim glow from directly behind | cold moonlight diffused through frosted glass | deep shadow with one accent highlight | candle-warm distant point light | dual colour split of deep blue and amber
- Perspective: extreme macro on surface texture | eye-level with product aligned to horizon line | 15° high angle looking down | low angle 10° looking up at product | straight-on symmetrical flat | 20° off-axis with depth-of-field bokeh

### STRUCTURE TECHNIQUE
Generate exactly ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} concepts: ${GENERATION_CONFIG.IMAGE_COUNT} images and ${GENERATION_CONFIG.VIDEO_COUNT} videos.
Each object MUST strictly follow this schema:
- "index": number (0-${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH - 1})
- "type": "image" or "video"

CRITICAL 20/80 HYBRID RATIO: Exactly 20% of images in the batch MUST be "cinematic" (Textless/UI-less, pure product in a high-end luxury studio setting). For "cinematic", the component_layout array MUST BE EMPTY.
The remaining 80% MUST be "direct_response" or "editorial" (Ad Layouts using the Component Registry).

- "component_layout": array — THE NEW COMPONENT REGISTRY (Lego Architecture).
  Output an array of 1 to 3 dynamic components for non-cinematic modes.
  Available components:
  1. { "component": "PointerBenefit", "props": { "label": "Text", "x": 0-100, "y": 0-100 } }
  2. { "component": "FeatureSwitch", "props": { "label": "Text", "x": 0-100, "y": 0-100 } }
  3. { "component": "SocialBadge", "props": { "label": "Text", "x": 0-100, "y": 0-100 } }
  4. { "component": "ScrollingRibbon", "props": { "text": "Text", "position": "top" | "bottom" } }
  5. { "component": "ComparisonSlider", "props": { "beforeText": "Before", "afterText": "After", "x": 0-100, "y": 0-100 } }
  6. { "component": "CleanIngredient", "props": { "ingredient": "Text", "subtext": "Text", "x": 0-100, "y": 0-100 } }
  7. { "component": "OutlineText", "props": { "text": "BIG", "x": 0-100, "y": 0-100, "fontSize": 120 } }
`;

async function main() {
    console.log("Generating dummy strategy via Gemini...");
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: "Product: Alpha Serum. Goal: Convert.",
        config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.7,
            responseMimeType: "application/json",
        },
    });

    console.log("--- RAW GEMINI JSON START ---");
    console.log(response.text);
    console.log("--- RAW GEMINI JSON END ---");
}

main().catch(console.error);
