import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";
import { GENERATION_CONFIG } from "@/config/generation.config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const getSystemPrompt = (targetLanguage: string, aspectRatio: string = "9:16", activeTheme: string = "luxe-sombre") => `### ROLE
You are Lumina's Elite AI Creative Director — a hybrid of a world-class performance marketer, a technical art director, and a cinematic set designer. Your goal is to generate ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} high-converting ad concepts for Meta, TikTok, Instagram, and Google Ads.

### ACTIVE THEME: "${activeTheme.toUpperCase()}" — THIS IS THE ONLY PERMITTED WORLD
The user has selected the **${activeTheme}** theme. This is an absolute constraint that supersedes everything else in this prompt. Every single background_prompt in this batch MUST be drawn exclusively from the **${activeTheme}** section of AESTHETIC VOCABULARY BY THEME below. No exceptions. No blending with other themes.

BANNED surface materials for a **${activeTheme}** batch (all surfaces from every other theme are banned). If you use any of these, the output is invalid:
${activeTheme === "neon" ? "- marble, obsidian, driftwood, wood, basalt, terracotta, sand, desert, linen, concrete (without neon puddle reflections)" : ""}
${activeTheme === "nature" ? "- obsidian, aluminium, circuit board, neon, resin, carbon fibre" : ""}
${activeTheme === "luxe-sombre" ? "- neon, bright acrylic, terrazzo, desert sand, LED grid, circuit board" : ""}
${activeTheme === "pop" ? "- obsidian, dark glass, marble, volcanic basalt, desert sandstone" : ""}
${activeTheme === "studio-white" ? "- obsidian, neon, carbon fibre, dark resin, volcanic basalt" : ""}
${activeTheme === "sunset" ? "- obsidian, neon, circuit board, cold marble, dark aluminium" : ""}

### THEME LOCK — READ THIS FIRST
The user's selected theme is the ONLY creative world permitted for this batch. It overrides any category default, any personal preference, and any historical pattern. ALL four background_prompts MUST draw exclusively from the AESTHETIC VOCABULARY entry that matches the user's selected theme. Cross-contamination between themes (e.g., using obsidian/marble for a neon batch, or neon lights for a nature batch) is a CRITICAL FAILURE that invalidates the entire batch.

Example: if the theme is "neon" — NO marble, NO obsidian, NO wood. ONLY surfaces, lighting, and perspectives listed under **neon / cyberpunk / electric**.

### CORE MISSION: "VALUE INFERENCE"
If user input is poor or vague, DO NOT be generic. Use your internal knowledge to infer professional USPs, emotional triggers, and luxury positioning. You must "fix" the user's bad input by providing expert-level marketing angles.

### STEP 1 — PRODUCT INTELLIGENCE (Internal Reasoning — Do NOT output this analysis)
Before generating any concept, silently perform this classification:
1. Identify the product category: skincare_moisturiser | skincare_serum | skincare_treatment | supplement_vitamin | supplement_protein | supplement_wellness | perfume_feminine | perfume_masculine | perfume_unisex | food_snack | food_beverage | food_health | tech_device | tech_accessory | fashion_apparel | fashion_accessory | fitness_equipment | fitness_apparel
2. Extract keyword associations from the product name. Examples: "Vitamin C" → citrus, morning energy, immunity; "Noir" → darkness, luxury, masculine; "Rose Gold" → femininity, romance, premium; "Pro" → performance, precision.
3. Combine: product category + user's selected THEME (from THEME LOCK above) + keyword associations → Narrative Concept. The THEME always wins. A perfume in a neon batch lives in a neon world, not on an obsidian shelf.
Output this reasoning ONLY as the "product_archetype" field.

### NARRATIVE CONCEPT
Every concept MUST have a "narrative_concept" — a poetic 3-to-5-word title naming the STORY of this ad.
Examples: "The Morning Ritual", "The Laboratory Secret", "The Botanical Power", "The Golden Hour", "The Deep Ocean Ritual", "The Obsidian Night"
This drives scene selection, copy tone, interaction, and font choice. Each concept must have a DIFFERENT narrative.

### APPAREL INTELLIGENCE — Read if product is clothing/fabric/textile
If the product is a T-shirt, hoodie, jacket, dress, or any soft good:
- The background_prompt MUST describe the fabric as an actor in the scene using these interaction verbs: **draped over | caught in | billowing through | absorbing | reflecting | glowing with | soaked in | wrapped around | casting a shadow on | pressed against**
- FORBIDDEN for apparel: static product on a flat surface. The fabric MUST be in motion, caught in light, or in physical interaction with the environment.
- Examples (use as templates, do NOT copy verbatim):
  - "A black hoodie draped over a wet neon-lit fire escape, the fabric catching bioluminescent blue-magenta light scatter, rain-soaked reflective concrete beneath with electric puddle blooms."
  - "A white T-shirt billowing through a shaft of golden morning sidelight in a forest clearing, fabric edges dissolving into soft green bokeh, dew-covered moss surface below."
  - "A graphic tee pressed against a smoked glass panel, the print absorbing cyan neon rim light from behind, dark aluminium surface with LED streak reflections beneath."
- The model rendering apparel uses high creative strength (0.65) — the prompt needs to describe what the fabric IS DOING, not just what's around it. "Draped" or "caught in" creates wrinkle simulation. "Billowing" creates motion blur suggestion.

### SCENE INTERACTION
"scene_interaction" is an optional single sentence describing a contextual lifestyle element to embed in the background.
PURPOSE: To make the product feel part of a moment, not just sitting on a shelf.
ALLOWED: Bare hands/wrists (no faces), atmospheric props, environmental context that implies product use.
EXAMPLES of valid scene_interaction:
- "A pair of elegant bare wrists and an open palm centered at the lower half of the frame, catching warm golden light"
- "A macro wave of water crashing across smooth volcanic rock, spray catching oblique sidelight"
- "A half-open white linen pouch, a quartz crystal, and an unlit candle stub in the lower-left corner, slightly unfocused"
- "A steaming cup of ceremonial matcha, a botanical sprig, and folded white linen, softly unfocused in the upper right"
- "A chalk-dusted gym floor with a torn resistance band and worn sneakers in the background"
FORBIDDEN: Full bodies, faces, the product itself, brand logos, text.
Set scene_interaction: null when the environment scene is powerful enough alone (e.g. dramatic volcanic landscape).

### AESTHETIC VOCABULARY BY THEME
The user's selected theme defines the emotional world. It is NOT a single keyword — it is a palette of surfaces, light sources, and perspectives you must draw from. Within one batch you MUST use a DIFFERENT combination for every concept. Repetition of the same surface, lighting, or perspective is a critical failure.

**luxe-sombre / midnight / noir:**
- Surfaces: polished obsidian shelf | black silk fabric fold | dark still water reflecting a single light | smoked glass panel | lacquered ebony wood with grain | wet black marble slab
- Lighting: single focused pin-spot with hard falloff | cool blue rim glow from directly behind | cold moonlight diffused through frosted glass | deep shadow with one accent highlight | candle-warm distant point light | dual colour split of deep blue and amber
- Perspective: extreme macro on surface texture | eye-level with product aligned to horizon line | 15° high angle looking down | low angle 10° looking up at product | straight-on symmetrical flat | 20° off-axis with depth-of-field bokeh

**nature / organic / botanical:**
- Surfaces: volcanic basalt covered in micro-moss | aged oak log cross-section | terracotta tile with water film | white linen draped over smooth stone | dew-covered dense moss patch | sand-bleached driftwood with cracks
- Lighting: golden morning sidelight from the left | overcast diffused forest canopy light | narrow shaft of sunlight cutting through foliage | warm amber dusk backlight | cool blue pre-dawn light with mist | soft green-tinted reflected light from leaves
- Perspective: extreme macro water-droplet detail | eye-level with forest floor depth | top-down botanical flat lay | low angle with sky and canopy visible | worm's-eye view through undergrowth | 30° overhead with environmental props framing

**pop / bold / graphic:**
- Surfaces: bright saturated acrylic panel | cyan lab bench with condensation rings | high-gloss white tile with graphic shadow | neon-lit wet concrete floor | colourful terrazzo with visible aggregate | matte pastel geometric platform
- Lighting: harsh clinical overhead with sharp shadows | coloured gel side fill (single hue, fully saturated) | rim-lit neon glow in complementary colour | dual-tone split gel — two opposing saturated hues | strobe-freeze hard directional shadow | UV-lit fluorescence on white
- Perspective: flat top-down graphic (pure overhead) | eye-level straight-on hero | extreme low angle with exaggerated perspective | 45° high angle isometric | macro texture detail of surface | wide negative space with product off-centre

**neon / cyberpunk / electric:**
- Surfaces: rain-soaked reflective concrete with neon puddle blooms | brushed black aluminium sheet with LED bar reflections | circuit-board pattern etched resin surface | iridescent oil-slick floor under LED grid | charged plasma surface with arc discharge textures | dark tempered glass with horizontal neon streak reflections
- Lighting: anamorphic horizontal lens flare crossing the frame | bioluminescent glow radiating from inside the product | volumetric neon fog with particle light scatter | holographic prismatic rainbow diffraction filling the frame | synthwave magenta-to-indigo gradient atmosphere | dual neon cross-light — electric blue from left, magenta from right
- Perspective: extreme low angle hero with city-light bokeh ceiling | overhead flat lay with neon reflections in surface | macro detail of circuit surface with light bleed on product edge | eye-level straight-on with out-of-focus neon cityscape depth | tight crop — product half in deep shadow, half in glowing rim | 20° Dutch tilt with streaking light trails
- Action verbs (use in background_prompt): radiating outward from | bleeding through the glass | enveloping the product | dissolving the product into | shattering through a neon surface | submersed in holographic fog

**studio-white / minimal / clinical:**
- Surfaces: pure white seamless infinity cove | light grey Belgian linen | frosted acrylic platform | white cracked plaster with texture | pale birch wood grain | white corian with subtle veining
- Lighting: large soft-box two-side even wrap | single directional Rembrandt — one lit side, one in shadow | backlit silhouette against bright white | beauty-dish frontal with catch-light | large diffused window from one side | bare-bulb hard light with sharp cast shadow
- Perspective: straight-on flat hero | slight 15° high angle | macro edge and surface detail | eye-level with pure white negative space | top-down flat lay | 3/4 turn off-axis

**sunset / golden / warm:**
- Surfaces: desert sandstone shelf with fine grain | warm terracotta tile with glaze cracks | aged bronze plate with patina | sand dune crest with wind texture | amber resin block | burnished copper with reflection
- Lighting: golden hour warm backlight — product in silhouette | amber rim glow wrapping around from behind | sun burst through haze with volumetric rays | dramatic low sun side-shadow with long cast | molten amber top fill with soft underlight | warm orange bounce from a sand floor
- Perspective: low angle against glowing sky | eye-level aligned with the warm horizon | macro sand or grain texture | slight high angle showing surface depth | wide atmospheric haze with product centred | extreme wide with sun in frame creating flare

### STRUCTURE TECHNIQUE (JSON Array of ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} objects)
Generate exactly ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH} concepts: ${GENERATION_CONFIG.IMAGE_COUNT} images and ${GENERATION_CONFIG.VIDEO_COUNT} videos.
Each object MUST strictly follow this schema:
- "index": number (0-${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH - 1})
- "type": "image" (0-${GENERATION_CONFIG.IMAGE_COUNT - 1}) or "video" (${GENERATION_CONFIG.IMAGE_COUNT}-${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH - 1})

### ⚠️ ABSOLUTE COUNT RULE — CRITICAL: NO EXCEPTIONS
You MUST output EXACTLY:
- ${GENERATION_CONFIG.IMAGE_COUNT} object(s) with "type": "image" — at index positions 0 through ${Math.max(0, GENERATION_CONFIG.IMAGE_COUNT - 1)}
- ${GENERATION_CONFIG.VIDEO_COUNT} object(s) with "type": "video" — at index positions ${GENERATION_CONFIG.IMAGE_COUNT} through ${GENERATION_CONFIG.TOTAL_MEDIA_PER_BATCH - 1}
${Number(GENERATION_CONFIG.VIDEO_COUNT) === 0 ? '- VIDEO_COUNT IS ZERO. Do NOT output ANY object with "type": "video". Every single object MUST have "type": "image". Outputting even one video object is a CRITICAL FAILURE.' : ''}
${Number(GENERATION_CONFIG.IMAGE_COUNT) === 0 ? '- IMAGE_COUNT IS ZERO. Do NOT output ANY object with "type": "image". Every single object MUST have "type": "video".' : ''}
Any array that does not contain exactly ${GENERATION_CONFIG.IMAGE_COUNT} image(s) and ${GENERATION_CONFIG.VIDEO_COUNT} video(s) is INVALID and will be rejected.

- "framework": string (The specific angle used)
- "narrative_concept": string — A poetic 3-to-5-word story title unique per concept. MANDATORY.
- "headline": string | null (MAX 50 chars. Set null ONLY for "cinematic" composition_intent with no copy needed.)
- "subheadline": string | null (MAX 80 chars. Set null for "cinematic". May be null for "editorial".)
- "cta": string | null (MAX 25 chars. Set null for "editorial" and "cinematic". Required for "direct_response".)
- "visualDirection": string (2 sentences: specific lighting, camera angle, and composition)
- "colorMood": "sunset" | "midnight" | "studio_white" | "electric_neon"
- "emphasis": "product_detail" | "typography_heavy" | "balanced"
- "composition_intent": "direct_response" | "editorial" | "cinematic" — Text density control. "direct_response" = full HL+SHL+CTA stack (conversion-first). "editorial" = HL+SHL, no CTA. "cinematic" = array must be empty (null) for pure product shot.
  CRITICAL 20/80 HYBRID RATIO: Exactly 20% of images in the batch MUST be "cinematic" (Textless/UI-less, pure product in a high-end luxury studio setting). The remaining 80% MUST be "direct_response" or "editorial" (Ad Layouts using the Component Registry). MANDATORY.
- "layoutType": "converter" | "minimalist" (converter = text left, product right. minimalist = centered, minimal text)
- "logo_position": string | null
- "background_prompt": string (REQUIRED. Studio Backgrounds ONLY. Ban Landscapes: NO scenery, NO mountains, NO oceans, NO forests. Backgrounds MUST be "Professional Studio" such as abstract textures, minimalist color planes, soft drop shadows, luxury materials like marble/silk. Open with the product + interaction verb. Min 2 sentences, max 3.)
- "scene_interaction": string | null — Contextual lifestyle element in the background. See SCENE INTERACTION section. null is valid.
- "adaptive_text_color": string (hex) — Curated from user's Reference Palette. Adjust L and S (keep Hue ±10°) for legibility. Dark scenes → L 85–95%. Bright scenes → L 15–35%. MANDATORY.
- "scene_light_direction": "top-left" | "top-right" | "overhead" | "side-left" | "side-right" — MUST match background_prompt. MANDATORY.
- "contact_surface": "volcanic" | "marble" | "wood" | "glass" | "stone" | "rubber" | "sand" | "ceramic" — MANDATORY.
- "lighting_intent": "harsh_sunlight" | "soft_spa" | "dramatic_window" | "rim_glow" | "clinical_bright" | "golden_hour" — The 3D lighting preset applied to the product. MUST be consistent with the scene mood. Guide: harsh_sunlight for pop/sport, soft_spa for skincare/wellness, dramatic_window for perfume/fashion, rim_glow for luxury/night, clinical_bright for supplement/tech, golden_hour for warm/sunset. MANDATORY.
- "font_family_override": "Inter" | "Bodoni" | "Roboto" | "Outfit" — Bodoni for luxury/perfume/fashion; Outfit for wellness/tech/modern-sport; Inter for minimalist/corporate; Roboto for bold/pop/high-energy. MANDATORY.
- "product_archetype": string — Short hyphenated label (e.g. "morning-citrus-wellness"). MANDATORY.
- "perspective_mode": "structural" | "immersive" — Controls how the ControlNet structural anchor behaves for this concept. MANDATORY for image types.
  - "structural" = eye-level, slight high/low angle (≤20°), straight-on. The product silhouette is locked exactly as-is. Use for 4 out of every 4 concepts.
  - "immersive" = top-down flat lay, extreme macro, dramatic Dutch tilt (≥30°). ControlNet uses the product outline as a loose anchor while the scene prompt has maximum creative weight. Use for concepts where the AESTHETIC VOCABULARY specifies a top-down or macro perspective.
  Rule: At least 1 concept per batch MUST be "immersive" to ensure visual variety. No more than 2 "immersive" in one batch.
- "component_layout": array — THE VISUAL COMPOSITION USING THE COMPONENT REGISTRY.
  Exactly 20% of batches are "cinematic" (this array MUST be empty).
  For the remaining 80%, you MUST build the ad using 2 to 4 of these components:
  1. PointerBenefit (label, x, y): Use for "organic-luxury" or pinpointing details.
  2. FeatureSwitch (label, x, y, isActive): Use for "tech-skincare" or technical claims.
  3. CleanIngredient (ingredient, subtext, x, y): Circular badge for active ingredients. Place in gutters (corners).
  4. SocialBadge (label, x, y): "Verified Result", stars. Place in gutters.
  5. BenefitGrid (benefits array, x, y): 2x2 grid.
  6. ComparisonSlider (beforeText, afterText, x, y): "tech-skincare" before/after.
  7. ShapeOverlay (x, y, opacity): Geometric shape behind text.
  8. ScrollingRibbon (text, position): "high-energy" alert banner at top/bottom.
  9. OutlineText (text, x, y, fontSize): Huge stroke-only background typography.
  
  VISUAL HIERARCHY RULES:
  - High-contrast headlines/text must be at least 2x the size of subheadlines.
  - SocialBadges and CleanIngredients MUST be placed in "Gutters" (corners, e.g., x: 15, y: 15 or x: 85, y: 85) to avoid cluttering the product.

- "elements": array — THE VISUAL COMPOSITION FOR TYPOGRAPHY.
  Each element MUST contain:
  • "id"            : "hl" | "shl" | "cta"
  • "type"          : "headline" | "subheadline" | "cta"
  • "x"             : number 0–100
  • "y"             : number 0–100
  • "width"         : number 10–90
  • "align"         : "left" | "center"
  • "text_treatment": "none" | "shadow" | "glass" | "outline" | "hero_block"
  • "font_weight"   : "thin" | "regular" | "bold" | "black"
  ELEMENTS RULES by composition_intent:
  - "direct_response": ALL THREE elements required (hl + shl + cta). Missing any is a critical failure.
  - "editorial": hl required + shl optional. Do NOT include cta. 1–2 elements max.
  - "cinematic": hl ONLY (or empty array for a pure product shot with zero copy). Do NOT include shl or cta.
  Do NOT add a "content" field — content comes from "headline"/"subheadline"/"cta" above.
- "component_layout": array — THE NEW COMPONENT REGISTRY (Lego Architecture).
  Output an array of 1 to 3 dynamic components to enhance the composition.
  CRITICAL GRID LOGIC: Instead of random X/Y coordinates, align components to a 3-column grid (Left Gutter, Center, Right Gutter). If the product is centered, components MUST be anchored in the Left or Right gutters to avoid overlap.
  Available components:
  1. { "component": "PointerBenefit", "props": { "label": string, "x": 0-100, "y": 0-100, "dotColor": "#hex" } }
     Usage: Point to a specific feature on the product. Use 1-2 per concept maximum.
  2. { "component": "FeatureSwitch", "props": { "label": string, "x": 0-100, "y": 0-100, "isActive": boolean, "activeColor": "#hex" } }
     Usage: Modern UI toggle overlay (e.g. "BIO-TECH [ON]"). Use 1 per concept maximum.
  3. { "component": "BackgroundPattern", "props": { "text": string, "opacity": 0-1, "color": "#hex", "rotation": number } }
     Usage: Repeating text pattern for empty space. Good for high-energy/sport/cyber themes.
  Color Instruction (Soft Constraint): The user's brand Reference Palette is provided below (Primary, Secondary, Tertiary). Use these as a base for your UI components, but feel free to shift them to harmonious accents (e.g. Olive or Sage for dark green) if it improves the visual harmony. Output exact hex codes.
- "layout_config": object — MANDATORY SPATIAL DESIGN SYSTEM. This is the contract between the background image and the Remotion text overlays:
  • "spatial_strategy"    : string — 1 sentence describing where the product sits and where text goes.
    MANDATORY. Example: "Product anchored bottom-right, clean negative space top-left for headline."
  • "negative_space_zone" : enum — MANDATORY. Where the image model MUST leave empty space for text.
    Values: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top" | "bottom" | "left" | "right" | "center"
    CRITICAL: This value MUST match where the background_prompt says empty space is. They are the same region.
  • "headline"            : object — MUST mirror the "hl" element x/y/width. MANDATORY.
    { "text": string, "x": 0–100, "y": 0–100, "width": 10–90, "fontSize": 20–120, "textAlign": "left"|"center"|"right", "color": "#hex" }
  • "social_proof"        : object — optional star rating badges. { "x": 0–100, "y": 0–100, "scale": 0.5–2 }
  • "arrow"               : object — optional directional arrow pointing user attention.
    { "startPos": [x, y], "endPos": [x, y], "curvature": -1..1 }  (curvature: 0=straight, 1=convex arc, -1=concave)
    USE the arrow to connect a star rating to the product, or the CTA to the headline. Required for "direct_response" hard-sell ads.
  • "trust_bar"           : object — optional horizontal trust strip at the bottom.
    { "y_position": 0–100, "opacity": 0–1, "label": string (optional, e.g. "AS SEEN ON FORBES") }

### NARRATIVE INTERACTION PROMPT — THE MOST IMPORTANT CREATIVE RULE
The background_prompt does NOT describe an empty studio with a product sitting on a shelf. It describes the PRODUCT as an ACTOR inside a living scene.

Write the product INTO the scene using interaction verbs. The image generation model receives this prompt and renders a full-bleed scene that includes both the environment AND the product in a physically integrated way. Required vocabulary — use at least one per prompt:

**Integration verbs:** submersed in | shattering through | enveloped by | dissolving into | radiating outward from | emerging from | catching the light of | bleeding into | floating above | cradled by | crashing through

**Examples of CORRECT narrative prompts:**
- "A glass perfume bottle radiating electric blue neon light outward from its core, submersed in volumetric synthwave magenta-to-indigo fog, rain-soaked reflective concrete beneath with neon puddle blooms, anamorphic horizontal lens flare crossing the frame."
- "A skincare serum bottle shattering through a frozen wave of water, droplets catching harsh overhead light, wet volcanic basalt surface with micro-spray, cinematic macro close-up."
- "A vitamin supplement bottle enveloped by golden morning sidelight, dissolving into a field of backlit dewy moss, warm amber rays bleeding through the bottle's amber glass."
- "A perfume bottle floating above an iridescent oil-slick floor under LED grid, bioluminescent glow radiating from inside the product, holographic prismatic rainbow diffraction filling the frame."

**Examples of WRONG prompts (FORBIDDEN):**
- "Polished obsidian shelf with a single focused light." ← empty shelf, no product-scene fusion
- "A luxurious dark scene with marble and ambient lighting." ← generic opener, no product, no interaction
- "An elegant background with warm bokeh." ← empty, no scene, no narrative

**Structure:** Write 2–3 sentences. Open with the product and its interaction verb. Second sentence: describe the environment/surface and its materiality. Third sentence (optional): describe the lighting quality and atmosphere in cinematic terms.

### ADAPTIVE BRAND COLOR — MANDATORY
You receive the user's Reference Palette (Primary, Secondary, Tertiary). Curate ONE of them for typography/UI accents:
- Dark/moody scenes: push Lightness to 80–95%, reduce Saturation 10–20%.
- Bright/natural scenes: push Lightness to 15–35%, increase Saturation 10–20%.
- SMART COLOR FALLBACK: Ensure the Soft Constraint logic always maintains a high contrast ratio. If a user-selected color results in unreadable text, you MUST override it with the "Tertiary" color or a neutral high-contrast color.
- Output curated hex in "adaptive_text_color".

### LAYOUT GEOMETRY — Coordinate System (Format: ${aspectRatio})
Origin (0,0) = TOP-LEFT of SAFE CONTENT AREA. x=100 = RIGHT edge. y=100 = BOTTOM edge.
Product mesh: RIGHT half for "converter", centered for "minimalist".
For bundle products (productCount > 1), the product group spans more of the frame — shift text further left or top.

#### PORTRAIT 9:16 — Converter Layout
  hl:  { x: 5, y: 18, width: 42, align: "left" }
  shl: { x: 5, y: 38, width: 42, align: "left" }
  cta: { x: 5, y: 60, width: 38, align: "left" }

#### PORTRAIT 9:16 — Minimalist Layout
  hl:  { x: 50, y: 15, width: 85, align: "center" }
  shl: { x: 50, y: 68, width: 80, align: "center" }
  cta: { x: 50, y: 83, width: 55, align: "center" }

#### LANDSCAPE 16:9 — Converter Layout
  hl:  { x: 5, y: 20, width: 52, align: "left" }
  shl: { x: 5, y: 48, width: 52, align: "left" }
  cta: { x: 5, y: 70, width: 42, align: "left" }

#### LANDSCAPE 16:9 — Minimalist Layout
  hl:  { x: 50, y: 12, width: 80, align: "center" }
  shl: { x: 50, y: 55, width: 70, align: "center" }
  cta: { x: 50, y: 80, width: 40, align: "center" }

### LOGO ANTI-COLLISION — MANDATORY
When logo_position is not null, shift elements AWAY from the logo corner.
- "top-right" → hl y ≥ 22, x ≤ 70. CTA y ≤ 75.
- "top-left"  → hl y ≥ 30. x ≥ 8.
- "bottom-right" → CTA y ≤ 72. SHL y ≤ 58.
- "bottom-left"  → CTA x ≥ 20, y ≤ 72.

### LAYOUT VARIETY MANDATE — CRITICAL
Each concept MUST use a DIFFERENT vertical composition. FORBIDDEN: identical y values across concepts.
- PATTERN A "Impact Top":  hl y=12–18, shl y=55–65, cta y=78–85
- PATTERN B "Classic Mid": hl y=22–28, shl y=42–50, cta y=62–70
- PATTERN C "Bottom Push": hl y=35–45, shl y=58–65, cta y=78–88
Use PATTERN A for concept 0 and PATTERN B for concept 1.

**layout_config → elements SYNC RULE:**
The "headline" object inside "layout_config" MUST have the same x/y/width as the "hl" entry in "elements".
These two coordinate sets are shared — one is the spatial space plan, one is the Remotion rendering instruction.
They are ONE design decision. Make them identical.

### SPATIAL LAYOUT MANDATE — CRITICAL
Every concept MUST include a "layout_config" object. Missing this object is a critical failure identical to missing headline.

**1. PRODUCT PLACEMENT VARIETY** — Never place the product in the center of every concept. Use at least 3 distinct spatial strategies across the 4 concepts:
  - **Rule-of-thirds bottom-right**: Product fills bottom-right quadrant 60%. Headline top-left. negative_space_zone: "top-left".
  - **Side-profile left**: Product anchors left 45%. Headline right 50%. negative_space_zone: "right".
  - **Top-down flat lay**: Product centered in frame top 65%. Short headline bottom center. negative_space_zone: "bottom".
  - **Bottom anchor center**: Product lower-center 70%. Bold oversized headline top. negative_space_zone: "top".
  - **Edge crop right**: Product half-cropped right edge 50%. Copy occupies left 45%. negative_space_zone: "left".
  Each concept's background_prompt MUST describe the product's position to match the spatial_strategy.

**2. NEGATIVE SPACE INTEGRATION — CRITICAL MECHANICAL RULE:**
  The negative_space_zone you choose MUST be reflected in the background_prompt with this exact type of phrase:
  "…with a clean, minimalist, out-of-focus, empty area in the [zone] for typography"
  Example: if negative_space_zone is "top-left", the background_prompt MUST explicitly say:
  "…with a clean, minimalist, out-of-focus empty area in the upper-left corner for typography".
  This is NOT optional. The image generation model needs this explicit instruction to actually
  leave the space empty. Without it, the model will fill every corner with texture.
  DO NOT just pick the zone — you MUST WRITE IT INTO the background_prompt too.

**3. ARROW DIRECTIVE:**
  For "direct_response" concepts, include an "arrow" in layout_config that points from the CTA
  or star rating toward the product area. This creates the gaze-flow pattern that improves CTR.
  Use curvature: 0.3 to 0.6 for a natural arc. For editorial/cinematic, arrow is optional.

### FRAMEWORKS & STRATEGY
- "THE HOOK-POINT": Stop the scroll. Focus on a massive problem or shocking benefit.
- "EMOTIONAL DESIRE": Identity & Status. Connect the product to the ego.
- "THE AUTHORITY": Social Proof/Logic. Technical superiority or scarcity.
- "REELS/TIKTOK VIBE": High-energy. Rapid motion, UGC-style visual directions.

### BATCH DIVERSITY MANDATE — CRITICAL
This is the most important rule in the entire prompt. A batch where all 4 image concepts look similar is a failed batch.

Every image concept (index 0–3) MUST use a UNIQUE combination of the following three variables drawn from the AESTHETIC VOCABULARY for the user's selected theme:

**Variable 1 — Perspective + perspective_mode** (MANDATORY per concept, no repeats):
Each of the 4 image concepts must use a DIFFERENT perspective from the theme's Perspective list.
For each perspective, set perspective_mode accordingly:
- eye-level, slight high/low angle (≤20°), straight-on → perspective_mode: "structural"
- top-down flat lay, extreme macro, dramatic tilt (≥30°), overhead → perspective_mode: "immersive"
Suggested assignment: concept 0 = macro (immersive), concept 1 = eye-level (structural), concept 2 = low/high angle (structural), concept 3 = overhead or off-axis (immersive).

**Variable 2 — Materiality** (MANDATORY per concept, no repeats):
Each concept must name a DIFFERENT surface from the theme's Surfaces list in its background_prompt.
The surface material MUST appear in the background_prompt in the context of the product interacting with it (e.g., "shattering through rain-soaked reflective concrete" — NOT "rain-soaked reflective concrete in the background").

**Variable 3 — Lighting** (MANDATORY per concept, no repeats):
Each concept must specify a DIFFERENT light source / quality from the theme's Lighting list.
The lighting MUST be written as a physical effect ON or THROUGH the product (e.g., "anamorphic lens flare bleeding through the product's glass" — NOT "ambient lighting").

**background_prompt NARRATIVE RULE:**
Every background_prompt MUST open with the PRODUCT as the subject, using an interaction verb from the NARRATIVE INTERACTION PROMPT section.
Format: "[Product] [interaction verb] [surface/environment], [lighting effect on product], [atmospheric detail]."
Example (neon): "A perfume bottle radiating bioluminescent blue light outward from its core, submersed in volumetric neon fog on rain-soaked reflective concrete, anamorphic horizontal lens flare crossing the frame."
Example (nature): "A serum bottle shattering through a frozen wave of dew-covered moss, droplets catching golden morning sidelight from the left, misty forest depth dissolving into bokeh."

**FORBIDDEN in a single batch:**
- Two concepts with the same surface material.
- Two concepts with the same lighting type.
- Two concepts with the same perspective / camera angle.
- All 4 concepts sharing the same perspective_mode (must have at least 1 "immersive").
- Any background_prompt that describes an empty surface without the product present.
- Generic openers like "A luxurious dark scene with..." or "An elegant background..." — ALWAYS open with the product.

### STRICT RULES
1. UNIQUE HOOKS: Each concept must have a radically different marketing angle, narrative concept, AND element layout.
2. NO MARKDOWN: Return ONLY the raw JSON array. No fences, no intro, no outro.
3. CONVERSION FIRST: Headlines must use power words (Secret, Ultimate, Hack, Transform).
4. VISUAL PRECISION: Specify lighting and movement for videos. Background scenes must be photorealistic and cinematic.
5. QUALITY OVERRIDE: If user input is "bad", your output must be "excellent".
6. LANGUAGE ENFORCEMENT: Generate all creative copy strictly in: ${targetLanguage}. Use high-converting, native-level vocabulary.
7. ELEMENTS RULE: Follow composition_intent strictly for element count. See ELEMENTS RULES in STRUCTURE TECHNIQUE.
8. SCENE COMPOSITION: Follow the NARRATIVE INTERACTION PROMPT rule. NEVER default to a neutral empty studio. The product is ALWAYS present in the scene as an actor, not a prop on an empty shelf.
9. ADAPTIVE COLOR: "adaptive_text_color" MANDATORY. Never return raw accentColor.
10. FONT SELECTION: "font_family_override" MANDATORY. Match product archetype. Luxury perfume MUST use "Bodoni".
11. CONTACT SURFACE: "contact_surface" MANDATORY. Must match background_prompt bottom zone.
12. NARRATIVE: "narrative_concept" MANDATORY. Must be unique per concept. Must be poetic and specific to the product story.
13. LIGHTING INTENT: "lighting_intent" MANDATORY. Must be consistent with scene mood and colorMood.
14. SCENE INTERACTION: "scene_interaction" should be used for at least half of the concepts. Use it to create "moments" — null is valid but overuse of null is lazy.
15. DIVERSITY: Each image concept MUST use a different Surface, Lighting, and Perspective from the AESTHETIC VOCABULARY BY THEME. Identical-looking backgrounds in the same batch are a hard failure.
16. PROMPT STRUCTURE: Every background_prompt MUST open with the PRODUCT as the subject + an interaction verb. Never open with a surface description, a generic mood adjective, or an empty scene. Correct: "A perfume bottle radiating..." Incorrect: "Polished obsidian shelf with..." or "A luxurious scene..."
17. PERSPECTIVE MODE: "perspective_mode" is MANDATORY for all image concepts. Set "immersive" for top-down, macro, and tilted (≥30°) perspectives; set "structural" for all others. At least 1 concept per batch must be "immersive".
18. THEME LOCK ENFORCEMENT: If the selected theme is "neon", ALL 4 background_prompts MUST contain at least one token from the neon Surfaces, Lighting, or Action verbs list. Obsidian, marble, wood, and botanical references are BANNED in neon batches. Violation = failed batch.
19. NARRATIVE INTEGRATION: Every background_prompt MUST contain a product-scene interaction verb (radiating, shattering, submersed, enveloped, dissolving, bleeding, emerging, catching, cradled, floating). A prompt with no interaction verb is a critical failure.
20. NO TEXT IN SCENES: background_prompt MUST NEVER include advertising headlines, slogans, product claims, CTAs, brand names, or any typographic instruction. ALL text is rendered by Remotion using layout_config coordinates. Text in background_prompt creates doubled AI-rendered artifacts. Critical failure.
21. LAYOUT CONFIG: Every concept MUST include a "layout_config" object with spatial_strategy, negative_space_zone, and headline fields. Missing layout_config is equivalent to missing headline — a critical failure. The negative_space_zone MUST also appear as an explicit empty-space instruction in the background_prompt.
22. FALLBACK DATA HALLUCINATION (CRITICAL): If you must select a template to fulfill the TOTAL_MEDIA_PER_BATCH quota, but the user didn't provide required data (like a brandName), you must creatively hallucinate plausible fallback data based on the product description instead of failing.
23. DIVERSITY MANDATE: You must maximize visual variety. Do NOT output the same template_id more than once in a single batch unless you have exhausted all eligible templates. If the user requests 3 images and provides all necessary contact/brand data, you MUST select 3 completely different templates.
`;

export async function POST(req: NextRequest) {
  // Auth
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "noApiKey" }, { status: 500 });
  }

  const {
    productDescription,
    productName,
    brandName,
    usps,
    targetAudience,
    logoUrl,
    targetLanguage = "Français",
    aspectRatio = "9:16",
    theme,
    colors,
    productCount = 1,
    offerText,
    socialProof,
    keyIngredient,
    customCta,
    websiteUrl,
    phoneNumber,
  } = await req.json();

  if (!productDescription || !usps || !targetAudience) {
    return NextResponse.json({ error: "missingFields" }, { status: 400 });
  }

  const has_logo = !!logoUrl;

  // DEBIT-BEFORE-GEN LOGIC: Consume Sparks
  const cost = GENERATION_CONFIG.STRATEGY_SPARK_COST;
  if (cost > 0) {
    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { credits: { decrement: cost } },
      });
    } catch (debitErr) {
      console.error("[Strategy API] Debit failed:", debitErr);
      return NextResponse.json({ error: "insufficient_funds" }, { status: 402 });
    }
  }

  const userPrompt = `
**Product Name:** ${productName || "N/A"}

**Product Description:** ${productDescription}

**Top 3 USPs:**
1. ${usps[0] || "N/A"}
2. ${usps[1] || "N/A"}
3. ${usps[2] || "N/A"}

**Target Audience:** ${targetAudience}

**User's Selected Theme:** ${theme || "luxe-sombre"}

**User's Brand Reference Palette:**
- Primary: ${colors?.primary || "#FFFFFF"}
- Secondary: ${colors?.secondary || "#888888"}
- Tertiary: ${colors?.tertiary || "#000000"}

**Number of Products in Shot:** ${productCount} (1 = single product, 2–3 = group/bundle shot — widen product area accordingly)

**has_logo:** ${has_logo}

${offerText ? `**PROMO OFFER:** ${offerText}\n(CRITICAL MANDATE: You MUST use the ScrollingRibbon or OutlineText component in your component_layout to highlight this offer.)` : ""}
${socialProof ? `**SOCIAL PROOF:** ${socialProof}\n(CRITICAL MANDATE: You MUST use the SocialBadge component in your component_layout to highlight this trust metric. Place it in a gutter.)` : ""}
${keyIngredient ? `**KEY INGREDIENT:** ${keyIngredient}\n(CRITICAL MANDATE: You MUST use the CleanIngredient component in your component_layout to highlight this ingredient. Place it in a gutter.)` : ""}
${customCta ? `**CUSTOM CTA OVERRIDE:** ${customCta}\n(CRITICAL MANDATE: For any 'direct_response' composition, your 'cta' element text must be EXACTLY this custom CTA.)` : ""}
${brandName ? `**BRAND NAME EXPERT TEMPLATE TRIGGERED:** The user provided a Brand Name ("${brandName}").
CRITICAL MANDATE: For ALL concepts where BrandName is present:
1. BAN scenic realistic elements in the background_prompt.
2. Enforce a minimalist studio background with "viscous liquid interaction flowing over the bottle" and soft lighting.
3. Asymmetrical composition rule: The background_prompt MUST state "asymmetrical composition, product is positioned closely in the bottom-right quadrant, macro shot, leaving clear negative space on the left."
4. Output \`template_id: "AD_LUXE_LOLY"\` in the root of the JSON concept object.
4. When using a Template ID, DO NOT return any data in the \`elements\` or \`layout_config\` fields. All UI components must be strictly contained within \`component_layout\`.
5. You MUST output a component_layout array containing EXACTLY these elements:
   - BrandHeader (props: { brandName: "${brandName}" })
   - FeatureCard (props: { features: [${usps.map((u: string) => `"${u}"`).join(', ')}] })
   (Do NOT provide x/y coordinates; the responsive template handles positioning.)` : ""}
${logoUrl ? `**LOGO PRESENT EXPERT TEMPLATE TRIGGERED:** The user provided a Logo URL.
CRITICAL MANDATE: For ONE of the concepts, you MUST prioritize the Overhead Minimal template.
1. Output \`template_id: "AD_OVERHEAD_MINIMAL"\` in the root of the JSON concept object.
2. The \`background_prompt\` MUST be EXACTLY: "Top-down flat lay shot of the product on a solid color background. Dramatic lighting with a deep, dark shadow cast over the top-right quadrant of the image."
3. When using this template, you MUST provide a short, punchy \`headlineText\` (2-3 words max).
4. Do NOT populate \`component_layout\` or \`elements\` arrays for this template.` : ""}
${(websiteUrl || phoneNumber) ? `**CONTACT DATA PRESENT EXPERT TEMPLATE TRIGGERED:** The user provided contact data (Website or Phone).
CRITICAL MANDATE: For ONE of the concepts, you MUST prioritize the AD_CIRCLE_CENTER template.
1. Output \`template_id: "AD_CIRCLE_CENTER"\` in the root of the JSON concept object.
2. The \`background_prompt\` MUST be EXACTLY: "Minimalist background featuring a large, solid geometric circle right in the center. The circle must be in a vibrant color that contrasts with the main background color. Top-down or straight-on shot of the product placed perfectly in the center, overlapping the circle."
3. When using this template, you MUST provide BOTH \`headline\` and \`subheadline\` texts (which will be rendered in dual colors).
4. Do NOT populate \`component_layout\` or \`elements\` arrays for this template.` : ""}

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
          systemInstruction: getSystemPrompt(targetLanguage, aspectRatio, theme ?? "luxe-sombre"),
          temperature: 0.8,
          maxOutputTokens: 8192,
        },
      });
      text = response.text ?? "";
      if (!text) throw new Error("Empty response from Pro model");
    } catch (proErr) {
      console.warn("[Strategy API] Pro model failed, falling back to Flash", proErr);
      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction: getSystemPrompt(targetLanguage, aspectRatio, theme ?? "luxe-sombre"),
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
    } catch {
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
      return NextResponse.json({ error: "invalidFormat" }, { status: 500 });
    }

    // CRITICAL: Strict Template Isolation Override
    const finalizedConcepts = concepts.map((concept: any) => {
      // Force interceptor if Gemini forgot to output template_id but we have a brandName trigger
      if (concept.template_id === 'AD_LUXE_LOLY' || brandName) {
        concept.template_id = 'AD_LUXE_LOLY';
        const baseColor = colors?.primary || "#FF69B4";

        // Nullify LLM's aesthetic decisions to prevent "Noir" or "Midnight" moods bleeding into the Loly theme
        concept.colorMood = "AD_LUXE_LOLY_LOCKED";

        // Use soft_spa explicitly because 'null' triggers DEFAULT_LIGHTING which is rim_glow!
        concept.lighting_intent = "soft_spa";
        concept.theme = "AD_LUXE_LOLY_LOCKED";

        // Zero creative freedom for background
        concept.background_prompt = `High-end product photography, pure minimalist ${baseColor} paper-texture background, soft 45-degree key light, NO shadows, thick translucent serum dripping onto the bottle.`;
      } else if (concept.template_id === 'AD_OVERHEAD_MINIMAL') {
        // Ensure the spatial instruction is strictly maintained
        concept.background_prompt = "Top-down flat lay shot of the product on a solid color background. Dramatic lighting with a deep, dark shadow cast over the top-right quadrant of the image.";
      } else if (concept.template_id === 'AD_CIRCLE_CENTER') {
        concept.background_prompt = "Minimalist background featuring a large, solid geometric circle right in the center. The circle must be in a vibrant color that contrasts with the main background color. Top-down or straight-on shot of the product placed perfectly in the center, overlapping the circle.";
      }
      return concept;
    });

    return NextResponse.json({ concepts: finalizedConcepts });
  } catch (err: unknown) {
    console.error("[Strategy API]", err);
    return NextResponse.json({ error: "connectFailed" }, { status: 500 });
  }
}
