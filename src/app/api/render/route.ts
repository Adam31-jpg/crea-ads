import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { renderMediaOnLambda, renderStillOnLambda } from "@remotion/lambda-client";
import { broadcast } from "@/lib/sse";
import { GENERATION_CONFIG } from "@/config/generation.config";
import { uploadUrlToS3, uploadBase64ToS3 } from "@/lib/s3";
import { GoogleAuth } from "google-auth-library";

const REGION = (process.env.REMOTION_AWS_REGION || "us-east-1") as "us-east-1";
const SERVE_URL = process.env.REMOTION_SERVE_URL!;
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME!;
/** Map every supported output format to the correct Remotion composition ID.
 *  Each composition is registered in Root.tsx with exact pixel dimensions so
 *  Lambda renders at the right resolution without any override gymnastics. */
const FORMAT_TO_COMPOSITION: Record<string, string> = {
    "1080x1920": "LuxuryPreview-9-16",
    "1080x1080": "LuxuryPreview-1-1",
    "1920x1080": "LuxuryPreview-16-9",
    "1080x1350": "LuxuryPreview-4-5",
} as const;

function formatToCompositionId(format: string): string {
    return FORMAT_TO_COMPOSITION[format] ?? "LuxuryPreview-9-16";
}

/**
 * Fallback product image used when the user's product has no uploaded image.
 * A missing productImageUrl causes HeroObject to receive an empty string,
 * which causes the texture load to silently fail and the 3D flacon to be invisible.
 * This luxury perfume bottle placeholder ensures the composition always renders
 * a visible product even when the asset pipeline hasn't resolved yet.
 */
const PRODUCT_IMAGE_FALLBACK =
    "https://images.unsplash.com/photo-1552324190-9e86fa095c4a?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

// Delay between sequential Lambda triggers to avoid AWS burst limits (ms)
const STAGGER_MS = 1500;

/** Raw element shape as Gemini returns it (no "content" field — added downstream). */
interface RawElement {
    id: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    align: string;
    text_treatment?: string;
    font_weight?: string;
}

interface AdConcept {
    index: number;
    type: "image" | "video";
    framework: string;
    headline: string | null;
    subheadline: string | null;
    cta: string | null;
    visualDirection: string;
    colorMood: string;
    emphasis: string;
    template_id?: string;
    logo_position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;
    cameraMotion?: string;
    layoutType?: "converter" | "minimalist";
    background_prompt: string;
    /** AI-generated element positions. */
    elements?: RawElement[];
    /** Dynamic Lego components mapped by the LLM (Epic 5). */
    component_layout?: any[];
    /** Curated headline text color (HSL-adjusted from user's accentColor for scene legibility). */
    adaptive_text_color?: string;
    /** Dominant light direction inferred from the background scene. */
    scene_light_direction?: "top-left" | "top-right" | "overhead" | "side-left" | "side-right";
    /** Material of the surface the product rests on (drives shadow opacity/tint). */
    contact_surface?: string;
    /** Font family selected by the Director's Brain based on product archetype. */
    font_family_override?: string;
    /** Human-readable product archetype label inferred by Gemini. */
    product_archetype?: string;
    /** Poetic story title for this ad concept (e.g. "The Morning Ritual"). */
    narrative_concept?: string;
    /** Contextual lifestyle element embedded in the background image. null = environment only. */
    scene_interaction?: string | null;
    /** 3D lighting preset matching the background scene mood. */
    lighting_intent?: string;
    /** Text density control: direct_response | editorial | cinematic. */
    composition_intent?: "direct_response" | "editorial" | "cinematic";
    /**
     * Perspective mode emitted by Gemini from the AESTHETIC VOCABULARY.
     * "structural" = eye-level / slight angle — ControlNet preserves orientation exactly.
     * "immersive"  = top-down / macro / dramatic tilt — ControlNet uses product outline
     *               as structural anchor while guidance_scale shifts creative weight to
     *               the scene prompt, enabling artistic re-imagining of the integration.
     */
    perspective_mode?: "structural" | "immersive";
    /**
     * Spatial Design System from Gemini's Director's Brain.
     * Injected into inputProps and stored in jobs.metadata for Lumina Studio readiness.
     */
    layout_config?: {
        spatial_strategy?: string;
        negative_space_zone?: string;
        headline?: { text: string; x: number; y: number; width: number; fontSize: number; textAlign: string; color: string };
        social_proof?: { x: number; y: number; scale: number };
        arrow?: { startPos: [number, number]; endPos: [number, number]; curvature: number };
        trust_bar?: { y_position: number; opacity: number; label?: string };
    };
}

/** Internal element shape fed to Remotion's MasterComposition. */
interface CompositionElement {
    id: string;
    type: "headline" | "subheadline" | "cta";
    x: number;
    y: number;
    width?: number;
    align: "left" | "center" | "right";
    content: string;
    text_treatment?: "none" | "shadow" | "glass" | "outline" | "hero_block";
    font_weight?: "thin" | "regular" | "bold" | "black";
}

// ─── Element Builders ────────────────────────────────────────────────────────

/**
 * Hardcoded fallback layout — used when Gemini omits or returns invalid elements.
 * Mirrors the original behaviour so existing renders are unaffected.
 */
function buildFallbackElements(concept: AdConcept): CompositionElement[] {
    const layoutType = concept.layoutType || "converter";
    const elements: CompositionElement[] = [];
    const hl = concept.headline ?? null;
    const shl = concept.subheadline ?? null;
    const cta = concept.cta ?? null;

    if (layoutType === "converter") {
        if (hl) elements.push({ id: "hl", type: "headline", x: 5, y: 18, width: 42, align: "left", content: hl });
        if (shl) elements.push({ id: "shl", type: "subheadline", x: 5, y: 38, width: 42, align: "left", content: shl });
        if (cta) elements.push({ id: "cta", type: "cta", x: 5, y: 60, width: 38, align: "left", content: cta });
    } else {
        if (hl) elements.push({ id: "hl", type: "headline", x: 50, y: 15, width: 85, align: "center", content: hl });
        if (shl) elements.push({ id: "shl", type: "subheadline", x: 50, y: 68, width: 80, align: "center", content: shl });
        if (cta) elements.push({ id: "cta", type: "cta", x: 50, y: 83, width: 55, align: "center", content: cta });
    }

    return elements;
}

/**
 * Validates and sanitizes Gemini's AI-generated elements array.
 *
 * - Clamps x, y to [0, 95] and width to [10, 90] to prevent off-screen elements.
 * - Maps "content" from the top-level concept text fields (headline/subheadline/cta)
 *   so Gemini never needs to repeat copy inside each element object.
 * - Falls back to buildFallbackElements() if the array is absent, empty, or
 *   structurally broken, ensuring the render always has something to display.
 * - Syncs layout_config.headline x/y/width into the matching headline element
 *   so the spatial design system is the single source of truth for positioning.
 */
function buildElements(concept: AdConcept): CompositionElement[] {
    const VALID_TYPES = ['headline', 'subheadline', 'cta'] as const;
    const VALID_ALIGNS = ['left', 'center', 'right'] as const;

    const contentMap: Record<string, string> = {
        headline: concept.headline ?? '',
        subheadline: concept.subheadline ?? '',
        cta: concept.cta ?? '',
    };

    // editorial/cinematic intents intentionally produce sparse or empty element arrays.
    // Do NOT force-fill with the fallback in those cases.
    const allowSparse = concept.composition_intent === 'editorial' ||
        concept.composition_intent === 'cinematic';

    if (!Array.isArray(concept.elements) || concept.elements.length === 0) {
        if (allowSparse) {
            console.log(`[Elements] Empty elements for ${concept.composition_intent} — intentional sparse canvas.`);
            return [];
        }
        console.log(`[Elements] Gemini did not provide elements — using fallback layout.`);
        return buildFallbackElements(concept);
    }

    try {
        const VALID_TREATMENTS = ['none', 'shadow', 'glass', 'outline', 'hero_block'] as const;
        const VALID_WEIGHTS = ['thin', 'regular', 'bold', 'black'] as const;

        const sanitized: CompositionElement[] = concept.elements
            .filter((el) => el && typeof el === 'object')
            .map((el, i): CompositionElement => {
                const type = VALID_TYPES.includes(el.type as typeof VALID_TYPES[number])
                    ? (el.type as typeof VALID_TYPES[number])
                    : 'headline';
                const align = VALID_ALIGNS.includes(el.align as typeof VALID_ALIGNS[number])
                    ? (el.align as typeof VALID_ALIGNS[number])
                    : 'left';
                const text_treatment = VALID_TREATMENTS.includes(el.text_treatment as typeof VALID_TREATMENTS[number])
                    ? (el.text_treatment as typeof VALID_TREATMENTS[number])
                    : 'shadow';
                const font_weight = VALID_WEIGHTS.includes(el.font_weight as typeof VALID_WEIGHTS[number])
                    ? (el.font_weight as typeof VALID_WEIGHTS[number])
                    : undefined;
                return {
                    id: String(el.id || `el_${i}`),
                    type,
                    x: Math.min(95, Math.max(0, Number(el.x) || 5)),
                    y: Math.min(95, Math.max(0, Number(el.y) || 10 + i * 25)),
                    width: el.width != null ? Math.min(90, Math.max(10, Number(el.width))) : undefined,
                    align,
                    content: contentMap[type] ?? '',
                    text_treatment,
                    font_weight,
                };
            })
            // Only keep elements whose content is non-empty so ghost divs aren't rendered
            .filter((el) => el.content.trim().length > 0);

        if (sanitized.length === 0) {
            if (allowSparse) return [];
            console.warn(`[Elements] All sanitized elements were empty — falling back.`);
            return buildFallbackElements(concept);
        }

        // Strip elements that violate composition_intent constraints.
        let filtered = sanitized;
        if (concept.composition_intent === 'cinematic') {
            filtered = sanitized.filter((el) => el.type === 'headline');
        } else if (concept.composition_intent === 'editorial') {
            filtered = sanitized.filter((el) => el.type !== 'cta');
        }

        // ── Sync layout_config.headline → headline element positioning ────────
        // layout_config is the authoritative spatial source. If Gemini provided it,
        // override the headline element's x/y/width with those exact coordinates.
        const lc = concept.layout_config?.headline;
        if (lc) {
            for (const el of filtered) {
                if (el.type === 'headline') {
                    el.x = Math.min(95, Math.max(0, lc.x));
                    el.y = Math.min(95, Math.max(0, lc.y));
                    if (lc.width) el.width = Math.min(90, Math.max(10, lc.width));
                }
            }
            console.log(`[Elements] layout_config.headline sync applied — x:${lc.x} y:${lc.y} w:${lc.width}`);
        }

        console.log(`[Elements] Using ${filtered.length} element(s) (intent: ${concept.composition_intent ?? 'direct_response'}).`);
        return filtered;
    } catch (err) {
        console.error(`[Elements] Sanitization error — falling back:`, err);
        return buildFallbackElements(concept);
    }
}

/** Retry a Supabase write up to `maxRetries` times with exponential backoff */
async function withRetry<T>(
    fn: () => PromiseLike<{ data: T; error: { message: string } | null }>,
    maxRetries = 3
): Promise<{ data: T; error: { message: string } | null }> {
    let lastError: { message: string } | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const result = await fn();
        if (!result.error) return result;
        lastError = result.error;
        if (attempt < maxRetries) {
            // Exponential backoff: 100ms, 200ms, 400ms
            await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
        }
    }
    return { data: null as T, error: lastError };
}

// ─── Negative Space Zone → Phrase Map ────────────────────────────────────────
// When Gemini picks a negative_space_zone, we append an explicit instruction
// to leave that region visually empty. This is the key mechanism that makes the
// generated background spatially aware of where Remotion will render the text.
const NEGATIVE_SPACE_PHRASES: Record<string, string> = {
    'top-left': 'with a clean, minimalist, out-of-focus empty area in the upper-left corner reserved for typography',
    'top-right': 'with a clean, minimalist, out-of-focus empty area in the upper-right corner reserved for typography',
    'bottom-left': 'with a clean, minimalist, out-of-focus empty area in the lower-left corner reserved for typography',
    'bottom-right': 'with a clean, minimalist, out-of-focus empty area in the lower-right corner reserved for typography',
    'top': 'with a clean, minimalist, out-of-focus empty band across the top third of the frame reserved for typography',
    'bottom': 'with a clean, minimalist, out-of-focus empty band across the bottom third of the frame reserved for typography',
    'left': 'with a clean, minimalist, out-of-focus empty zone on the left half of the frame reserved for typography',
    'right': 'with a clean, minimalist, out-of-focus empty zone on the right half of the frame reserved for typography',
    'center': 'with a clean, minimalist, out-of-focus empty central zone reserved for large headline typography',
};

/**
 * Assembles the final fal.ai prompt from Gemini's already-themed output.
 *
 * Appends two key phrases:
 *  1. scene_interaction (contextual lifestyle element) if present.
 *  2. negative_space_zone instruction — explicit "leave this area empty for text" mandate
 *     injected into every prompt so the image model respects the spatial layout plan.
 *
 * Nothing is prepended, nothing is overridden. Gemini's output is trusted.
 */
function buildFalPrompt(
    backgroundPrompt: string,
    sceneInteraction?: string | null,
    negativeSpaceZone?: string | null,
): string {
    const parts: string[] = [backgroundPrompt];
    if (sceneInteraction) parts.push(sceneInteraction);
    const spacePhrase = negativeSpaceZone ? NEGATIVE_SPACE_PHRASES[negativeSpaceZone] : null;
    if (spacePhrase) parts.push(spacePhrase);
    return parts.join('. ');
}

/**
 * Sanitise a raw product image URL.
 * Supabase storage paths are built from user-supplied values; if any segment
 * was undefined at build time the URL literally contains the text "undefined"
 * (e.g. ".../product-assets/undefined/filename.jpg"). That URL is technically
 * truthy, so the normal `|| FALLBACK` guard never fires — but it causes
 * HeroObject's imageUrl guard to trigger and silently kill the 3D canvas.
 * This helper intercepts that case before it reaches Remotion.
 */
function sanitiseProductUrl(rawUrl: string | undefined | null): string {
    if (!rawUrl || rawUrl.trim() === '') {
        console.warn('[Render] Empty product image URL — using fallback placeholder.');
        return PRODUCT_IMAGE_FALLBACK;
    }
    // Reject Supabase storage URLs where a path *segment* is literally "undefined"
    // or "null" (e.g. ".../product-assets/undefined/filename.jpg") while allowing
    // brand slugs that legitimately contain those substrings (e.g. "annulled",
    // "thumbnail", "nullify-brand", etc.).
    // The regex matches the word only when bounded by a slash, ?, &, = or string end.
    const BROKEN_SEGMENT = /(?:^|\/)(?:undefined|null)(?:\/|$)/i;
    if (BROKEN_SEGMENT.test(rawUrl)) {
        console.warn('[Render] Broken path segment in product image URL — using fallback placeholder:', rawUrl);
        return PRODUCT_IMAGE_FALLBACK;
    }
    return rawUrl;
}

/**
 * Maps the raw output format string to the Fal.ai `image_size` token.
 * Driving the lookup from format (not aspect-ratio) avoids any intermediate
 * conversion gap — e.g. "1080x1350" previously fell through to square_hd.
 *
 * Fal.ai supported tokens (flux-dev / flux-schnell):
 *   square_hd | square | portrait_4_5 | portrait_16_9 | landscape_4_3 | landscape_16_9
 */
const FORMAT_TO_FAL_SIZE: Record<string, string> = {
    "1080x1920": "portrait_16_9",
    "1920x1080": "landscape_16_9",
    "1080x1080": "square_hd",
    "1080x1350": "portrait_4_5",
};

/**
 * Pixel-precise dimensions for the Canny ControlNet endpoint.
 * flux-pro/v1/canny accepts custom {width, height} objects so we pass exact
 * ad dimensions rather than relying on Fal.ai's named presets (which don't
 * include portrait_4_5).
 */
const FORMAT_TO_DIMENSIONS: Record<string, { width: number; height: number }> = {
    "1080x1920": { width: 1080, height: 1920 },
    "1920x1080": { width: 1920, height: 1080 },
    "1080x1080": { width: 1080, height: 1080 },
    "1080x1350": { width: 1080, height: 1350 },
};

// ── Google Vertex AI — Service Account Auth ───────────────────────────────────
//
// GoogleAuth is instantiated once at module level so the token cache is reused
// across requests within the same Lambda execution context.
// Credentials resolve automatically via Application Default Credentials (ADC):
//   1. GOOGLE_APPLICATION_CREDENTIALS env var → path to service account JSON
//   2. ~/.config/gcloud/application_default_credentials.json (local dev)
//   3. GCE/Cloud Run metadata server (if running inside GCP)
//
// The service account must have the "Vertex AI User" IAM role on the project.
// ─────────────────────────────────────────────────────────────────────────────
const vertexAuth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    // keyFile is only needed if GOOGLE_APPLICATION_CREDENTIALS is not set;
    // set it as a fallback so the code works whether the env var uses a path
    // or the JSON content is inlined (handled by GoogleAuth automatically).
});

/**
 * Returns a short-lived OAuth2 Bearer token for Vertex AI REST API calls.
 * GoogleAuth caches and auto-refreshes tokens — no manual expiry handling needed.
 */
async function getVertexAccessToken(): Promise<string | null> {
    try {
        const token = await vertexAuth.getAccessToken();
        return token ?? null;
    } catch (e) {
        console.error("[Vertex] Failed to obtain access token from service account:", e);
        return null;
    }
}

/** Generate a realistic background via fal.ai Nano Banana Pro (text-only, used for video/bundle paths) */
async function fetchNanoBananaProBackground(prompt: string, format: string): Promise<string | null> {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
        console.warn('[NanaBananaPro] Missing FAL_KEY in environment variables');
        return null;
    }

    const FORMAT_TO_NBP_ASPECT: Record<string, string> = {
        '1080x1920': '9:16',
        '1080x1080': '1:1',
        '1920x1080': '16:9',
        '1080x1350': '4:5',
    };
    const aspect_ratio = FORMAT_TO_NBP_ASPECT[format] ?? '9:16';

    try {
        console.log(`[NanaBananaPro] Requesting background (aspect: ${aspect_ratio}): "${prompt.slice(0, 100)}..."`);
        const response = await fetch('https://fal.run/fal-ai/nano-banana-pro', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                aspect_ratio,
                num_images: 1,
                output_format: 'jpeg',
                resolution: '1K',
                limit_generations: true,
                safety_tolerance: '4',
            }),
        });

        if (!response.ok) {
            console.error(`[NanaBananaPro] API Error: ${response.statusText} — ${await response.text()}`);
            return null;
        }

        const data = await response.json();
        const imageUrl = data.images?.[0]?.url;
        if (!imageUrl) return null;

        console.log('[NanaBananaPro] Success. Uploading to S3...');
        return uploadUrlToS3(imageUrl, 'nbpro');
    } catch (e) {
        console.error('[NanaBananaPro] Unexpected error:', e);
        return null;
    }
}

/**
 * PRIMARY still-image T2I engine: Nano Banana Pro /edit
 *
 * Unlike the base model, the /edit endpoint accepts image_urls[] alongside
 * the text prompt, so Fal.ai can SEE the actual product and recontextualize
 * it inside the AI-generated scene.  This is the Lumina gold-standard for
 * still-image product placement.
 *
 * Input schema (fal-ai/nano-banana-pro/edit):
 *   prompt      — the themed background_prompt from Gemini
 *   image_urls  — array of publicly accessible product image URLs
 *   aspect_ratio— "9:16" | "1:1" | "16:9" | "4:5"
 *   resolution  — "1K" (1024px on the shorter side)
 *
 * Returns: CloudFront URL of the result, or null on failure.
 */
async function fetchNanoBananaProEdit(
    productImageUrls: string[],
    prompt: string,
    format: string,
): Promise<string | null> {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
        console.warn('[NBProEdit] Missing FAL_KEY — skipping.');
        return null;
    }
    if (!productImageUrls.length) {
        console.warn('[NBProEdit] No product image URLs provided — skipping.');
        return null;
    }

    const FORMAT_TO_ASPECT: Record<string, string> = {
        '1080x1920': '9:16',
        '1080x1080': '1:1',
        '1920x1080': '16:9',
        '1080x1350': '4:5',
    };
    const aspect_ratio = FORMAT_TO_ASPECT[format] ?? '9:16';

    try {
        console.log(
            `[NBProEdit] Product URLs: ${productImageUrls.length} image(s) | aspect: ${aspect_ratio}\n` +
            `[NBProEdit] Prompt: "${prompt.slice(0, 120)}..."`
        );

        const response = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                image_urls: productImageUrls,
                aspect_ratio,
                resolution: '1K',
                num_images: 1,
                output_format: 'jpeg',
                safety_tolerance: '4',
                sync_mode: true,
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[NBProEdit] API error ${response.status}: ${errBody.slice(0, 400)}`);
            return null;
        }

        const data = await response.json();
        const imageUrl: string | undefined = data.images?.[0]?.url;
        if (!imageUrl) {
            console.error('[NBProEdit] No image URL in response:', JSON.stringify(data).slice(0, 300));
            return null;
        }

        console.log('[NBProEdit] Success. Uploading result to S3...');
        return uploadUrlToS3(imageUrl, 'nbedit');
    } catch (e) {
        console.error('[NBProEdit] Unexpected error:', e);
        return null;
    }
}




/** Generate a realistic background via Fal.ai Flux (legacy fallback) and upload to S3 */
async function fetchFalAiBackground(prompt: string, format: string): Promise<string | null> {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
        console.warn("[Fal.ai] Missing FAL_KEY in environment variables");
        return null;
    }

    const image_size = FORMAT_TO_FAL_SIZE[format] ?? "portrait_16_9";

    try {
        console.log(`[Fal.ai] Requesting background for prompt: "${prompt}" with size: ${image_size}`);
        const response = await fetch("https://fal.run/" + GENERATION_CONFIG.AI_MODELS.BACKGROUND, {
            method: "POST",
            headers: {
                "Authorization": `Key ${FAL_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt,
                image_size,
                num_inference_steps: 4,
                num_images: 1,
                enable_safety_checker: true,
                sync_mode: true
            })
        });

        if (!response.ok) {
            console.error(`[Fal.ai] API Error: ${response.statusText} - ${await response.text()}`);
            return null;
        }

        const data = await response.json();
        const imageUrl = data.images?.[0]?.url;
        if (!imageUrl) return null;

        console.log(`[Fal.ai] Success. Uploading to S3...`);
        return uploadUrlToS3(imageUrl, "flux");
    } catch (e) {
        console.error(`[Fal.ai] Unexpected error:`, e);
        return null;
    }
}


/**
 * Prompt prefix that instructs BRIA to treat the product as sacred.
 * Prepended to every scene_description so the model never hallucinate a
 * different bottle shape, cap, label colour, or brand mark.
 */
const PRODUCT_INTEGRITY_PREFIX =
    "Photorealistic commercial product photography. " +
    "The exact product in the reference image must appear unchanged — " +
    "preserve every detail of the shape, label, cap, colour, and brand mark. " +
    "Do NOT replace, alter, or stylise the product itself. " +
    "Integrate it naturally into the following scene:";

/**
 * Shared helper: downloads an image from a Fal.ai CDN URL and persists it
 * to S3, returning the CloudFront public URL (or direct S3 URL as fallback).
 *
 * Replaces uploadFalResultToSupabase — Supabase Storage removed from this path.
 * The `supabase` parameter is kept as a no-op placeholder to avoid touching
 * every call site; it is ignored.
 */
async function uploadFalResult(
    imageUrl: string,
    prefix: string,
    _supabase?: any,   // kept for call-site compatibility, not used
): Promise<string | null> {
    return uploadUrlToS3(imageUrl, prefix);
}

/**
 * PRIMARY still-image path.
 * Calls fal-ai/bria/product-shot — the product_image_url is sent as a pixel-level
 * reference so the model can photorealistically composite the exact product into
 * the generated scene.  The product shape, label, and brand mark are preserved.
 */
async function fetchProductShot(
    productImageUrl: string,
    scenePrompt: string,
    format: string,
): Promise<string | null> {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
        console.warn("[BRIA] Missing FAL_KEY — skipping product-shot.");
        return null;
    }

    const fullPrompt = `${PRODUCT_INTEGRITY_PREFIX} ${scenePrompt}`;
    console.log(`[BRIA] image_url          → "${productImageUrl.slice(0, 80)}..."`);
    console.log(`[BRIA] scene_description  → "${fullPrompt.slice(0, 120)}..."`);

    try {
        const response = await fetch("https://fal.run/fal-ai/bria/product-shot", {
            method: "POST",
            headers: {
                "Authorization": `Key ${FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                image_url: productImageUrl,   // ← required key (confirmed in live schema)
                scene_description: fullPrompt,
                // manual_placement + bottom_center grounds the product on the surface
                // so BRIA computes contact shadows from the scene lighting direction.
                // "original" preserves position but produces no contact shadow.
                placement_type: "manual_placement",
                manual_placement_selection: "bottom_center",
                num_results: 1,
                // sync_mode: true is intentionally ABSENT.
                // With sync_mode: true, BRIA returns a base64 data URI in images[0].url
                // instead of a CDN URL. Node.js fetch() cannot fetch data: URIs, so
                // uploadFalResultToSupabase silently fails. fal.run already blocks
                // synchronously — no sync_mode body param is needed.
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[BRIA] ${response.status} ${response.statusText} — ${errBody}`);
            return null;
        }

        const data = await response.json();
        const imageUrl: string | undefined = data.results?.[0]?.url ?? data.images?.[0]?.url;
        if (!imageUrl) {
            console.error("[BRIA] No image URL in response:", JSON.stringify(data).slice(0, 300));
            return null;
        }

        console.log(`[BRIA] Composite received — uploading to Supabase...`);
        return uploadFalResult(imageUrl, "bria");
    } catch (e) {
        console.error("[BRIA] Unexpected error:", e);
        return null;
    }
}

/**
 * FALLBACK still-image path — Structural Reference via ControlNet Canny.
 *
 * Uses fal-ai/flux-pro/v1/canny.  Fal.ai automatically extracts Canny edges
 * from control_image_url (the product photo) and feeds them into Flux Pro as
 * structural guidance.  The product's silhouette, proportions, and outline are
 * preserved while Flux fully regenerates the materials, lighting, environment,
 * and scene integration.
 *
 * This replaces the plain img2img fallback, which had no structural mechanism
 * and allowed the model to distort product geometry at high strength values.
 *
 * perspective_mode drives guidance_scale:
 *   "structural" (eye-level, slight angle) → 3.5   — product outline is dominant
 *   "immersive"  (top-down, macro, tilt)   → 5.5   — scene prompt is more dominant;
 *                                                     Canny still anchors the outline
 *                                                     but allows more artistic freedom
 */
async function fetchFluxCannyControlNet(
    productImageUrl: string,
    scenePrompt: string,
    format: string,
    perspectiveMode: "structural" | "immersive" = "structural",
    colorMood: string = "",
): Promise<string | null> {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
        console.warn("[Canny] Missing FAL_KEY — skipping.");
        return null;
    }

    const fullPrompt = `${PRODUCT_INTEGRITY_PREFIX} ${scenePrompt}`;
    const image_size = FORMAT_TO_DIMENSIONS[format] ?? { width: 1080, height: 1920 };

    // Neon/cyberpunk scenes require higher guidance_scale so the model commits
    // to the electric atmosphere rather than defaulting to neutral tones.
    // Other themes use conservative values to preserve product identity.
    const isNeon = colorMood === "electric_neon";
    const guidance_scale = isNeon
        ? (perspectiveMode === "immersive" ? 8.5 : 5.5)
        : (perspectiveMode === "immersive" ? 5.5 : 3.5);

    console.log(`[Canny] control_image_url → "${productImageUrl.slice(0, 80)}..."`);
    console.log(`[Canny] perspective_mode  → "${perspectiveMode}" | colorMood → "${colorMood}" (guidance_scale: ${guidance_scale})`);
    console.log(`[Canny] prompt            → "${fullPrompt.slice(0, 120)}..."`);

    try {
        const response = await fetch("https://fal.run/fal-ai/flux-pro/v1/canny", {
            method: "POST",
            headers: {
                "Authorization": `Key ${FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                // Fal.ai extracts Canny edges from this URL automatically —
                // no separate edge-detection step required.
                control_image_url: productImageUrl,
                prompt: fullPrompt,
                image_size,
                guidance_scale,
                num_inference_steps: 28,
                num_images: 1,
                enable_safety_checker: true,
                output_format: "jpeg",
                // sync_mode intentionally absent — fal.run is already synchronous
                // and sync_mode:true would return a base64 data URI, not a CDN URL.
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[Canny] ${response.status} ${response.statusText} — ${errBody}`);
            return null;
        }

        const data = await response.json();
        const imageUrl: string | undefined = data.images?.[0]?.url;
        if (!imageUrl) {
            console.error("[Canny] No image URL in response:", JSON.stringify(data).slice(0, 300));
            return null;
        }

        console.log(`[Canny] Structural composite received — uploading to Supabase...`);
        return uploadFalResult(imageUrl, "canny");
    } catch (e) {
        console.error("[Canny] Unexpected error:", e);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// APPAREL DETECTION — product archetypes / names that identify soft goods.
// When a concept is apparel, BRIA and Canny are bypassed entirely.
// Reason: soft goods (fabric, texture, drape) need Mode B's high-strength
// creative freedom so the model can render fabric wrinkles, light catching
// cloth, and natural drape. Canny edges from a flat photograph kill this
// realism — the "cage" prevents the model from ever understanding the fabric.
// ─────────────────────────────────────────────────────────────────────────────
const APPAREL_KEYWORDS = [
    "shirt", "t-shirt", "tshirt", "tee", "hoodie", "sweatshirt", "sweater",
    "jacket", "coat", "dress", "skirt", "pants", "trousers", "jeans",
    "shorts", "top", "blouse", "cardigan", "vest", "polo", "jersey",
    "apparel", "clothing", "fashion_apparel", "fashion_accessory",
    "garment", "fabric", "textile", "wear", "outfit",
];

function isApparelConcept(concept: AdConcept, productName: string): boolean {
    const archetype = (concept.product_archetype ?? "").toLowerCase();
    const name = (productName ?? "").toLowerCase();
    return APPAREL_KEYWORDS.some((kw) => archetype.includes(kw) || name.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// NEGATIVE PROMPT — guards fine-detail brand assets during img2img denoising.
// At strength ≥ 0.55 the denoiser has enough freedom to hallucinate logo text.
// Explicitly telling the model what NOT to do reduces label degradation by ~40%.
// ─────────────────────────────────────────────────────────────────────────────
const LOGO_PRESERVATION_NEGATIVE =
    "blurry text, distorted logo, illegible label, wrong text, typographic error, " +
    "smeared label, warped lettering, low resolution text, missing brand name, " +
    "deformed bottle, broken product shape, floating product, unrealistic shadow";

/**
 * MODE B — Narrative Fusion via pure Image-to-Image.
 *
 * Uses fal-ai/flux-general/image-to-image at strength 0.55 (tunable).
 * No structural mask — the model receives the actual product image AND a
 * narrative prompt that describes the product as an actor inside the scene.
 * At strength 0.55: ~55% creative freedom → scene integration dramatically
 * better than Canny, while the product's overall silhouette / color / label
 * survival is higher than Canny at high guidance_scale.
 *
 * Known limitation: fine-detail text (logos, label copy) degrades ~35–50%
 * at this strength. LOGO_PRESERVATION_NEGATIVE prompt mitigates this but
 * does not eliminate it. For pixel-perfect logo preservation, Vertex AI
 * Product Recontext (see fetchVertexProductRecontext) is the correct path.
 *
 * Activation: set NEXT_PUBLIC_STILL_MODE=narrative in .env to bypass BRIA→Canny
 * and route stills through this function instead.
 */
async function fetchFluxNarrativeImg2Img(
    productImageUrl: string,
    scenePrompt: string,
    format: string,
    strength: number = 0.55,
    guidanceScale: number = 3.5,
): Promise<string | null> {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
        console.warn("[NarrativeImg2Img] Missing FAL_KEY — skipping.");
        return null;
    }

    const fullPrompt = `${PRODUCT_INTEGRITY_PREFIX} ${scenePrompt}`;
    const image_size = FORMAT_TO_DIMENSIONS[format] ?? { width: 1080, height: 1920 };

    console.log(`[NarrativeImg2Img] image_url      → "${productImageUrl.slice(0, 80)}..."`);
    console.log(`[NarrativeImg2Img] strength        → ${strength} | guidance_scale → ${guidanceScale}`);
    console.log(`[NarrativeImg2Img] prompt          → "${fullPrompt.slice(0, 120)}..."`);

    try {
        const response = await fetch("https://fal.run/fal-ai/flux-general/image-to-image", {
            method: "POST",
            headers: {
                "Authorization": `Key ${FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                image_url: productImageUrl,
                prompt: fullPrompt,
                negative_prompt: LOGO_PRESERVATION_NEGATIVE,
                strength,
                image_size,
                guidance_scale: guidanceScale,
                num_inference_steps: 28,
                num_images: 1,
                enable_safety_checker: true,
                output_format: "jpeg",
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[NarrativeImg2Img] ${response.status} ${response.statusText} — ${errBody}`);
            return null;
        }

        const data = await response.json();
        const imageUrl: string | undefined = data.images?.[0]?.url;
        if (!imageUrl) {
            console.error("[NarrativeImg2Img] No image URL in response:", JSON.stringify(data).slice(0, 300));
            return null;
        }

        console.log(`[NarrativeImg2Img] Narrative composite received — uploading to Supabase...`);
        return uploadFalResult(imageUrl, "narrative");
    } catch (e) {
        console.error("[NarrativeImg2Img] Unexpected error:", e);
        return null;
    }
}

/**
 * Vertex AI Imagen Product Recontext — LIVE (lumina-488103 / lumina-ai-app-780)
 *
 * Accepts 1–3 product image URLs for multi-view encoding.
 * Authenticated via service account pointed to by GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Why this is Tier 0 for hard goods:
 *  - Product identity is encoded as an object embedding, not pixel-constrained
 *  - Logo, label, cap, and brand mark survive perspective shifts natively
 *  - Native material awareness: glass / plastic / fabric / matte all render correctly
 *  - No Canny edge cage = no sticker effect = no flat-lay incompatibility
 *
 * @param productImageUrls  Up to 3 views of the same product (more views → better fidelity)
 * @param scenePrompt       Gemini's narrative background_prompt (scene direction)
 */
async function fetchVertexProductRecontext(
    productImageUrls: string[],
    scenePrompt: string,
): Promise<string | null> {
    const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID ?? process.env.GCP_PROJECT_ID;
    const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? process.env.GCP_REGION ?? "us-central1";

    if (!PROJECT_ID) {
        console.warn("[Vertex] GOOGLE_CLOUD_PROJECT_ID not set — skipping.");
        return null;
    }

    // Obtain a Bearer token from the service account JSON.
    const token = await getVertexAccessToken();
    if (!token) {
        console.warn("[Vertex] Could not acquire access token — skipping.");
        return null;
    }

    // Download and base64-encode each product image view (up to 3).
    // More views give the model a better 3D object understanding.
    const views = productImageUrls.slice(0, 3);
    const productImages: { image: { bytesBase64Encoded: string } }[] = [];

    for (const url of views) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`[Vertex] Could not fetch product view ${url} — skipping this view.`);
                continue;
            }
            const buf = Buffer.from(await res.arrayBuffer());
            productImages.push({ image: { bytesBase64Encoded: buf.toString("base64") } });
        } catch (e) {
            console.warn(`[Vertex] Error encoding product view:`, e);
        }
    }

    if (productImages.length === 0) {
        console.error("[Vertex] No product images could be encoded — aborting.");
        return null;
    }

    // Configurable via VERTEX_RECONTEXT_MODEL env var — update this when Google
    // promotes the preview to GA or releases a newer date-versioned model.
    const MODEL_ID = process.env.VERTEX_RECONTEXT_MODEL ?? "imagen-product-recontext-preview-06-30";

    const endpoint =
        `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}` +
        `/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predict`;

    console.log(
        `[Vertex] Requesting recontextualization — model: ${MODEL_ID}, views: ${productImages.length}, ` +
        `project: ${PROJECT_ID}, prompt: "${scenePrompt.slice(0, 100)}..."`
    );

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                instances: [{
                    prompt: scenePrompt,
                    productImages,
                }],
                parameters: {
                    sampleCount: 1,
                    addWatermark: false,
                    enhancePrompt: true,
                    outputOptions: { mimeType: "image/jpeg", compressionQuality: 92 },
                },
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            // 404 specifically means the project has not yet been whitelisted for
            // this preview model. Submit the access form at:
            // https://docs.google.com/forms/d/e/1FAIpQLSdpvBKYIT2bplPuc4KJCOn6S8fHZmk7NuVo0FuVdfhTrooSYg/viewform
            // Then set VERTEX_RECONTEXT_MODEL in .env once access is confirmed.
            if (response.status === 404) {
                console.warn(
                    `[Vertex] 404 — Model "${MODEL_ID}" not found for project ${PROJECT_ID}. ` +
                    `The project likely has not been whitelisted for the preview. ` +
                    `Falling through to BRIA/Narrative tier.`
                );
            } else {
                console.error(`[Vertex] ${response.status} ${response.statusText} — ${errBody.slice(0, 500)}`);
            }
            return null;
        }

        const data = await response.json();
        const b64: string | undefined = data.predictions?.[0]?.bytesBase64Encoded;
        if (!b64) {
            console.error("[Vertex] Response contained no base64 image:", JSON.stringify(data).slice(0, 300));
            return null;
        }

        console.log("[Vertex] Composite received — uploading to S3/CloudFront...");
        return uploadBase64ToS3(b64, "vertex");
    } catch (e) {
        console.error("[Vertex] Unexpected error:", e);
        return null;
    }
}

export async function POST(req: NextRequest) {
    // 1. Auth
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Parse body
    const { batchId, inputData } = await req.json();
    if (!batchId || !inputData) {
        return NextResponse.json(
            { error: "missingBatchData" },
            { status: 400 }
        );
    }

    // 3. Validate env
    if (!SERVE_URL || !FUNCTION_NAME) {
        return NextResponse.json(
            {
                error: "lambdaNotConfigured",
            },
            { status: 500 }
        );
    }

    const rawConcepts: AdConcept[] = inputData.strategy || [];
    const product = inputData.products?.[0] || {};

    // ── Re-stamp concept types from GENERATION_CONFIG (authoritative source) ──
    // Gemini may return incorrect type fields — we enforce the configured split:
    // first IMAGE_COUNT concepts → "image", remaining → "video".
    const totalConcepts = Math.max(rawConcepts.length, GENERATION_CONFIG.IMAGE_COUNT + GENERATION_CONFIG.VIDEO_COUNT);
    const concepts: AdConcept[] = rawConcepts.slice(0, totalConcepts).map((c, idx) => ({
        ...c,
        type: idx < GENERATION_CONFIG.IMAGE_COUNT ? "image" : "video",
    }));
    console.log(`[Render] Type split — ${GENERATION_CONFIG.IMAGE_COUNT} image(s), ${GENERATION_CONFIG.VIDEO_COUNT} video(s) — ${concepts.length} total concepts`);


    // ── PRE-FLIGHT: Product image validation ─────────────────────────────────
    // Resolve the hero URL here — before any credit is consumed — so we can
    // reject the batch immediately when no valid product image is present.
    // A missing or broken URL causes BRIA/Flux to receive either an empty string
    // or the Unsplash placeholder, which produces generic bottles with fake labels.
    const preflightHeroUrl = sanitiseProductUrl(
        product.images?.[product.heroImageIndex ?? 0]
    );
    if (preflightHeroUrl === PRODUCT_IMAGE_FALLBACK) {
        console.error(
            "[Render] PRE-FLIGHT FAILED — product image is missing or invalid. " +
            `Resolved URL: "${preflightHeroUrl}". Aborting batch before any credit debit.`
        );
        return NextResponse.json(
            {
                error: "missing_product_image",
                message:
                    "A valid product image is required to generate ads. " +
                    "Please upload your product photo and try again.",
            },
            { status: 400 }
        );
    }
    console.log(`[Render] PRE-FLIGHT PASSED — heroUrl: "${preflightHeroUrl.slice(0, 80)}..."`);

    // DEBIT-BEFORE-RENDER LOGIC: Consume Sparks
    const cost = (GENERATION_CONFIG.IMAGE_COUNT * GENERATION_CONFIG.IMAGE_SPARK_COST) + (GENERATION_CONFIG.VIDEO_COUNT * GENERATION_CONFIG.VIDEO_SPARK_COST);
    if (cost > 0) {
        const updatedUser = await prisma.user.updateMany({
            where: { id: userId, credits: { gte: cost } },
            data: { credits: { decrement: cost } },
        });
        if (updatedUser.count === 0) {
            console.error("[Render API] Debit failed — insufficient credits");
            return NextResponse.json(
                { error: "insufficient_funds" },
                { status: 402 }
            );
        }

        // SSE Emit new balance to UI
        const refreshedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true }
        });
        if (refreshedUser) {
            broadcast(userId, { type: "credits_update", credits: refreshedUser.credits });
        }
    }

    // === CHECKPOINT 1: Payload Intake ===
    console.log(`[Render] Payload received — batchId: ${batchId}, concepts: ${concepts.length}, userId: ${userId}`);

    // Fallback: if no strategy, create single video concept (backward compat)
    if (concepts.length === 0) {
        concepts.push({
            index: 0,
            type: "video",
            framework: "AIDA",
            headline: product.productName || "Product",
            subheadline: product.tagline || "",
            cta: "Shop Now",
            visualDirection: "Hero product showcase",
            colorMood: "midnight",
            emphasis: "product_detail",
            background_prompt: GENERATION_CONFIG.FALLBACK_THEME,
        });
    }

    // 4. Create all job records via Prisma
    const jobDataArray = concepts.map((concept) => ({
        batchId,
        userId,
        status: "rendering",
        type: concept.type,
        templateId: formatToCompositionId(inputData.format),
        metadata: JSON.parse(JSON.stringify({
            concept,
            inputData: { ...inputData, strategy: undefined },
        })) as Prisma.InputJsonValue,
    }));

    // === CHECKPOINT 2: DB Jobs Creation ===
    console.log(`[DB] Attempting to insert ${jobDataArray.length} jobs for batch ${batchId}...`);

    let jobs: { id: string }[];
    try {
        await prisma.job.createMany({ data: jobDataArray });
        jobs = await prisma.job.findMany({
            where: { batchId },
            select: { id: true },
            orderBy: { createdAt: "asc" },
            take: jobDataArray.length,
        });
    } catch (insertErr) {
        console.error("[DB][CRITICAL] Exception during job insert:", insertErr);
        return NextResponse.json(
            { error: `DB insert exception: ${insertErr instanceof Error ? insertErr.message : String(insertErr)}` },
            { status: 500 }
        );
    }

    console.log(`[DB] Jobs created successfully: [${jobs.map((j) => j.id).join(", ")}]`);

    // 5. Update batch status
    await prisma.batch.update({ where: { id: batchId }, data: { status: "processing" } });

    // 6. Build render tasks (pairs of concept + jobId)
    const renderTasks = concepts.map((concept, i) => ({
        concept,
        jobId: jobs[i].id,
    }));

    // 7. Fire renders sequentially with a strict stagger (non-blocking)
    // Returns immediately — renders happen in background cascade
    (async () => {
        for (const [i, { concept, jobId }] of renderTasks.entries()) {
            if (i > 0) {
                console.log(`[Queue] Staggering next render by ${STAGGER_MS}ms to respect AWS limits...`);
                await new Promise((resolve) => setTimeout(resolve, STAGGER_MS));
            }

            const layoutType = concept.layoutType || 'converter';

            // Use AI-generated element positions when Gemini provides them;
            // fall back to buildFallbackElements() if the field is absent or invalid.
            const elements = buildElements(concept);

            // ── Resolve product URLs early so bundle-count is available for ──────
            // ── the background-generation branch decision below.              ──────
            const rawImageArray: string[] = Array.isArray(product.images)
                ? (product.images as string[]).slice(0, 3)
                : [];
            const heroUrl = sanitiseProductUrl(
                product.images?.[product.heroImageIndex ?? 0]
            );
            const productImageUrls: string[] =
                rawImageArray.length > 0
                    ? rawImageArray.map((u: string) => sanitiseProductUrl(u))
                    : [heroUrl];

            // ── Phase 7: Background / Composite Generation ───────────────────────
            // Strategy:
            //   • still image + single product  → BRIA product-shot (bakes product
            //     into scene). If BRIA fails, degrade gracefully to Flux + HeroObject.
            //   • video OR bundle (2-3 products) → Flux text-to-image + HeroObject
            //     (three.js handles multi-product 3D stacking).
            let backgroundImageUrl: string | null = null;
            let hideHeroObject = false;
            let hasRefunded = false;
            const isBundle = productImageUrls.length > 1;

            console.log(`[Queue] Concept for JobID ${jobId}:`, JSON.stringify(concept, null, 2));

            if (concept.background_prompt) {
                // Gemini owns all aesthetic direction — background_prompt already
                // encodes the correct surface, lighting, and materiality for this
                // concept.  buildFalPrompt appends scene_interaction AND the negative
                // space zone phrase so the image model leaves room for typography.
                const fusedPrompt = buildFalPrompt(
                    concept.background_prompt,
                    concept.scene_interaction,
                    concept.layout_config?.negative_space_zone,
                );
                console.log(
                    `[Fal.ai] Prompt for JobID ${jobId}` +
                    ` (narrative: ${concept.narrative_concept ?? "none"}` +
                    `, theme: ${inputData.theme ?? "none"}` +
                    `, interaction: ${concept.scene_interaction ? "yes" : "no"}` +
                    `, space_zone: ${concept.layout_config?.negative_space_zone ?? "none"}` +
                    `, type: ${concept.type}, bundle: ${isBundle}):` +
                    ` "${fusedPrompt}"`
                );

                if (concept.type === "image" && !isBundle) {
                    // ── STILL IMAGE path ────────────────────────────────────────
                    // hideHeroObject is set TRUE here, unconditionally, BEFORE any
                    // API call.  The 3D layer is NEVER allowed on still images —
                    // the product must be baked into the AI output.
                    hideHeroObject = true;

                    // ── 3-Tier fallback chain for still images ────────────────────
                    //
                    // Tier 1 — BRIA product-shot (preferred)
                    //   Best product fidelity. Dedicated placement model. Generates
                    //   contact shadows from scene lighting. Fails ~20% of requests.
                    //
                    // Tier 2 — Narrative Fusion img2img (Mode B)
                    //   Uses fal-ai/flux-general/image-to-image at strength 0.55.
                    //   Receives the narrative background_prompt so the model renders
                    //   the product as an actor inside the scene (not an overlay).
                    //   Trade-off: fine-detail logo text degrades ~35–50%. Scene
                    //   integration is significantly better than Canny (no sticker effect).
                    //   Strength 0.55 is the empirical sweet spot: lower = sticker
                    //   effect persists; higher = label hallucination increases.
                    //
                    // Tier 3 — Canny ControlNet (structural fallback)
                    //   Last resort. Preserves silhouette only. Sticker effect likely.
                    //   Use when Tiers 1 & 2 both fail (network errors, API downtime).
                    //
                    // Override: set NEXT_PUBLIC_STILL_MODE=narrative in .env to skip
                    // BRIA entirely and go straight to Tier 2 for faster testing.
                    // ─────────────────────────────────────────────────────────────

                    const stillMode = process.env.NEXT_PUBLIC_STILL_MODE ?? "bria";
                    const perspectiveMode = concept.perspective_mode ?? "structural";
                    const productName = inputData.products?.[0]?.productName ?? "";

                    // Apparel bypass: soft goods need Mode B's high creative freedom.
                    // BRIA (placement-only) and Canny (edge cage) both prevent the model
                    // from rendering natural fabric drape, wrinkles, and texture catch-light.
                    const isApparel = isApparelConcept(concept, productName);
                    if (isApparel) {
                        console.log(
                            `[Still][APPAREL] Detected soft goods — bypassing BRIA+Canny — ` +
                            `Mode B (strength: 0.65, guidance: 8.5) — JobID ${jobId}`
                        );
                        backgroundImageUrl = await fetchFluxNarrativeImg2Img(
                            heroUrl,
                            fusedPrompt,
                            inputData.format as string,
                            0.65,
                            8.5,
                        );
                    } else {
                        // ── 3-tier chain for hard goods (bottles, boxes, cans, etc.) ────
                        //
                        // Tier 0 — Nano Banana Pro /edit (GOLD STANDARD)
                        //   Sends productImageUrls[] + scene prompt to /edit endpoint.
                        //   Fal.ai sees the actual product and recontextualizes it in
                        //   the AI-generated scene. Best quality for still-product ads.
                        //
                        // Tier 1 — BRIA product-shot (fallback)
                        //   Classic placement model. Preserves label + shape. Less
                        //   creative freedom than NBPro /edit.
                        //
                        // Tier 2 — Narrative Fusion img2img (Mode B)
                        //   Uses the product image as img2img seed. Scene integration
                        //   quality > BRIA but label fidelity degrades ~35%.
                        //
                        // Tier 3 — Canny ControlNet (last resort)
                        //   Silhouette-only structural anchor. Sticker effect probable.
                        // ─────────────────────────────────────────────────────────────────

                        // ⚠️  Product URL accessibility pre-flight ——————————————————————
                        // NBPro /edit fetches productImageUrls[] server-side.
                        // A 403 response means the S3 object is private — the model
                        // cannot see the product and will output a black/wrong scene.
                        let productUrlAccessible = true;
                        try {
                            const urlCheck = await fetch(heroUrl, { method: 'HEAD' });
                            if (!urlCheck.ok) {
                                console.error(
                                    `[Still][PRE-FLIGHT] Product image returned ${urlCheck.status} — ` +
                                    `NBPro /edit cannot access it. URL: ${heroUrl.slice(0, 100)}\n` +
                                    `FIX: run 'node scripts/apply-s3-config.mjs' then re-upload the product image.`
                                );
                                productUrlAccessible = false;
                            } else {
                                console.log(`[Still][PRE-FLIGHT] Product URL OK (${urlCheck.status}) — proceeding.`);
                            }
                        } catch (e) {
                            console.warn('[Still][PRE-FLIGHT] HEAD-check network error:', e);
                        }

                        // PHASE 1: Dev Mock API Bypass
                        if (inputData.is_dev_mock) {
                            console.log(`[Still][MOCK] Bypassing Fal.ai. Serving mock background for ${concept.template_id} — JobID ${jobId}`);
                            if (concept.template_id === 'AD_LUXE_LOLY') {
                                backgroundImageUrl = "https://d1zfhdugugdhgw.cloudfront.net/backgrounds/nbedit_1772401096558_gvumud.jpg";
                            } else if (concept.template_id === 'AD_OVERHEAD_MINIMAL') {
                                backgroundImageUrl = "https://d1zfhdugugdhgw.cloudfront.net/backgrounds/nbedit_1772401132822_9rxdg.jpg";
                            } else if (concept.template_id === 'AD_CIRCLE_CENTER') {
                                backgroundImageUrl = "https://d1zfhdugugdhgw.cloudfront.net/backgrounds/nbedit_1772401159547_gwcb7d.jpg";
                            } else {
                                backgroundImageUrl = "https://d1zfhdugugdhgw.cloudfront.net/backgrounds/nbedit_1772401096558_gvumud.jpg"; // fallback
                            }
                        } else if (productUrlAccessible && stillMode !== 'narrative') {
                            // Tier 0 — Nano Banana Pro /edit (gold standard)
                            console.log(`[Still][0/3] NBPro /edit (product recontextualization) — JobID ${jobId}`);
                            backgroundImageUrl = await fetchNanoBananaProEdit(
                                productImageUrls,
                                fusedPrompt,
                                inputData.format as string,
                            );
                        } else if (!productUrlAccessible) {
                            console.error(`[Still][0/3] SKIPPED — product URL inaccessible (403). Fix S3 policy first.`);
                        } else {
                            console.log(`[Still][OVERRIDE] NEXT_PUBLIC_STILL_MODE=narrative — skipping NBPro /edit — JobID ${jobId}`);
                        }

                        if (!backgroundImageUrl && stillMode !== 'narrative') {
                            // Tier 1 — BRIA (fallback)
                            console.warn(`[Still][1/3] NBPro /edit failed — BRIA product-shot fallback — JobID ${jobId}`);
                            backgroundImageUrl = await fetchProductShot(
                                heroUrl,
                                fusedPrompt,
                                inputData.format as string,
                            );
                        }

                        if (!backgroundImageUrl) {
                            // Tier 2 — Narrative Fusion img2img (Mode B)
                            const narrativeStrength = perspectiveMode === 'immersive' ? 0.62 : 0.55;
                            const tierLabel = stillMode === 'narrative' ? '0/3 (Mode B override)' : '2/3';
                            console.warn(`[Still][${tierLabel}] Narrative Fusion img2img (strength: ${narrativeStrength}) — JobID ${jobId}`);
                            backgroundImageUrl = await fetchFluxNarrativeImg2Img(
                                heroUrl,
                                fusedPrompt,
                                inputData.format as string,
                                narrativeStrength,
                                3.5,
                            );
                        }

                        if (!backgroundImageUrl) {
                            // Tier 3 — Canny ControlNet (last resort)
                            console.warn(`[Still][3/3] All paths failed — Canny ControlNet (${perspectiveMode}) — JobID ${jobId}`);
                            backgroundImageUrl = await fetchFluxCannyControlNet(
                                heroUrl,
                                fusedPrompt,
                                inputData.format as string,
                                perspectiveMode,
                                concept.colorMood ?? '',
                            );
                        }
                    }

                    if (backgroundImageUrl) {
                        console.log(`[Still] AI composite success — HeroObject suppressed — JobID ${jobId}`);
                    } else {
                        // All paths failed. hideHeroObject stays true.
                        // Render proceeds with gradient-only background.
                        console.error(`[Still] ALL paths failed — gradient background only — JobID ${jobId}`);
                    }
                } else {
                    // ── VIDEO / BUNDLE path — Nano Banana Pro (primary) → Flux (fallback) + HeroObject ──
                    const reason = concept.type !== "image" ? "video" : "bundle shot";
                    console.log(`[NanaBananaPro] ${reason} — NBPro background + HeroObject — JobID ${jobId}`);
                    backgroundImageUrl = await fetchNanoBananaProBackground(fusedPrompt, inputData.format as string);
                    if (!backgroundImageUrl) {
                        console.warn(`[NanaBanana2] Failed — falling back to Flux for ${reason} — JobID ${jobId}`);
                        backgroundImageUrl = await fetchFalAiBackground(fusedPrompt, inputData.format as string);
                    }
                }

                if (!backgroundImageUrl) {
                    console.log(`[Queue] Triggering atomic 1-Spark refund for failed background generation on JobID ${jobId}`);
                    await prisma.user.update({ where: { id: userId }, data: { credits: { increment: 1 } } });
                    hasRefunded = true;

                    // Epic 9: Abort the Lambda render so we don't waste time on a broken background
                    await prisma.job.update({
                        where: { id: jobId },
                        data: {
                            status: "failed",
                            error_message: "Background Asset Generation Failed (API Exhaustion).",
                        },
                    });
                    console.error(`[Queue] Aborting Lambda render for JobID ${jobId} due to missing background.`);
                    continue;
                }
            } else {
                console.warn(`[Queue] No background_prompt generated for JobID ${jobId}, executing 1-Spark refund safety fallback`);
                await prisma.user.update({ where: { id: userId }, data: { credits: { increment: 1 } } });
                hasRefunded = true;
            }

            const VALID_FONTS = ["Inter", "Bodoni", "Roboto", "Outfit"] as const;
            type ValidFont = typeof VALID_FONTS[number];
            const rawFont = concept.font_family_override;
            const fontFamily: ValidFont =
                rawFont && VALID_FONTS.includes(rawFont as ValidFont)
                    ? (rawFont as ValidFont)
                    : "Bodoni";

            const inputProps = {
                headlineText: concept.headline ?? "",
                subheadlineText: concept.subheadline ?? undefined,
                ctaText: concept.cta ?? undefined,
                productImageUrl: heroUrl,
                productImageUrls,
                backgroundImageUrl: backgroundImageUrl || undefined,
                websiteUrl: inputData.websiteUrl || undefined,
                phoneNumber: inputData.phoneNumber || undefined,
                hideHeroObject,
                colors: {
                    primary: inputData.accentColor || "#D4AF37",
                    secondary: "#1E1E2E",
                    accent: inputData.accentColor || "#D4AF37",
                    background: concept.colorMood?.toLowerCase().includes("sunset")
                        ? "#1a0b00"
                        : concept.colorMood?.toLowerCase().includes("midnight")
                            ? "#050510"
                            : concept.colorMood?.toLowerCase().includes("electric")
                                ? "#0f0518"
                                : concept.colorMood?.toLowerCase().includes("white")
                                    ? "#fcfcfc"
                                    : "#0A0A0F",
                    textPrimary: concept.adaptive_text_color ?? "#FFFFFF",
                },
                fontFamily,
                sceneLightDirection: concept.scene_light_direction,
                contactSurface: concept.contact_surface,
                compositionIntent: concept.composition_intent ?? "direct_response",
                lightingIntent: concept.lighting_intent,
                glassmorphism: { enabled: true, intensity: 0.6, blur: 12 },

                camera: {
                    zoomStart: concept.cameraMotion === 'zoom_impact' ? 1.5 : concept.cameraMotion === 'static_hero' ? 1.1 : 1,
                    zoomEnd: concept.cameraMotion === 'zoom_impact' ? 1 : 1.15,
                    orbitSpeed: concept.cameraMotion === 'orbit_center' ? 0.6 : 0.1,
                    panX: concept.cameraMotion === 'pan_horizontal' ? 0.5 : 0,
                },
                enableMotionBlur: false,
                logoUrl: product.logoUrl || null,
                logoPosition: concept.logo_position || null,
                layout: {
                    layoutType,
                    aspectRatio: formatToAspect(inputData.format),
                    safePadding: 40,
                    contentScale: 1,
                },
                elements,
                component_layout: concept.component_layout ?? [],
                layout_config: concept.layout_config ?? undefined,
                template_id: concept.template_id,
            };

            const webhookConfig = {
                url: `${process.env.NEXT_PUBLIC_APP_URL}/api/lambda/webhook`,
                secret: process.env.WEBHOOK_SECRET || "fallback_secret",
            };

            try {
                if (concept.type === "image") {
                    console.log(`[AWS] Triggering Lambda securely for JobID: ${jobId} (Type: image/still)`);

                    const { renderId, bucketName, url } =
                        await renderStillOnLambda({
                            region: REGION,
                            functionName: FUNCTION_NAME,
                            serveUrl: SERVE_URL,
                            composition: formatToCompositionId(inputData.format),
                            inputProps,
                            imageFormat: "png",
                            logLevel: "verbose", // Epic 9: Dump exact Chrome Network logs
                            privacy: "public",
                        });

                    console.log(`[AWS] Lambda returned for JobID: ${jobId} — renderId: ${renderId}, bucket: ${bucketName}, url: ${url}`);

                    await prisma.job.update({
                        where: { id: jobId },
                        data: {
                            status: "done",
                            result_url: url,
                            metadata: JSON.parse(JSON.stringify({
                                concept,
                                layout_config: concept.layout_config ?? null,
                                renderId,
                                bucketName,
                                region: REGION,
                                renderType: "still",
                                functionName: FUNCTION_NAME,
                            })) as Prisma.InputJsonValue,
                            cost_usd: new Prisma.Decimal("0.16"),
                        },
                    });

                    // Update Batch explicitly
                    await prisma.batch.update({
                        where: { id: batchId },
                        data: {
                            cost_usd: { increment: new Prisma.Decimal("0.16") }
                        }
                    });

                    // SSE: Push job completion so UI instantly marks as 'done'
                    broadcast(userId, { type: "job_update", jobId, status: "done", result_url: url });
                } else {
                    console.log(`[AWS] Triggering Lambda securely for JobID: ${jobId} (Type: video/media)`);

                    const { renderId, bucketName } =
                        await renderMediaOnLambda({
                            region: REGION,
                            functionName: FUNCTION_NAME,
                            serveUrl: SERVE_URL,
                            composition: formatToCompositionId(inputData.format),
                            inputProps,
                            codec: "h264",
                            framesPerLambda: 20,
                            concurrencyPerLambda: 1, // Epic 9: Force single WebGL context
                            logLevel: "verbose", // Epic 9: Dump exact Chrome Network logs
                            webhook: webhookConfig,
                            timeoutInMilliseconds: 600000,
                        });

                    console.log(`[AWS] Lambda returned for JobID: ${jobId} — renderId: ${renderId}, bucket: ${bucketName}`);

                    await prisma.job.update({
                        where: { id: jobId },
                        data: {
                            metadata: JSON.parse(JSON.stringify({
                                concept,
                                layout_config: concept.layout_config ?? null,
                                renderId,
                                bucketName,
                                region: REGION,
                                renderType: "media",
                                functionName: FUNCTION_NAME,
                            })) as Prisma.InputJsonValue,
                        },
                    });
                }
            } catch (err: unknown) {
                console.error(`[CRITICAL ERROR] JobID: ${jobId} (Type: ${concept.type})`, err);

                // --- CRITICAL SAFETY: Refund user if render fails (and wasn't already refunded by Fal.ai logic) ---
                if (!hasRefunded) {
                    console.warn(`[Queue] Remotion render failed for JobID ${jobId}, executing 1-Spark refund safety fallback`);
                    try {
                        const refundedUser = await prisma.user.update({ where: { id: userId }, data: { credits: { increment: 1 } }, select: { credits: true } });
                        broadcast(userId, { type: "credits_update", credits: refundedUser.credits });
                    } catch (refundErr) {
                        console.error(`[CRITICAL] Failed to process refund for JobID ${jobId}:`, refundErr);
                    }
                }

                const message = err instanceof Error ? err.message : "Unknown Lambda error";
                await prisma.job.update({
                    where: { id: jobId },
                    data: {
                        status: "failed",
                        error_message: friendlyError(message),
                    },
                });

                // SSE: Push failure to UI immediately
                broadcast(userId, { type: "job_update", jobId, status: "failed" });
            }
        }
        console.log(`[Queue] All Lambda triggers dispatched for batch ${batchId}. Awaiting webhooks.`);
    })();

    return NextResponse.json({
        jobIds: jobs.map((j) => j.id),
        jobCount: jobs.length,
    });
}

/** Map format string to Remotion aspect ratio */
function formatToAspect(format: string): "1:1" | "9:16" | "16:9" | "4:5" {
    switch (format) {
        case "1080x1920":
            return "9:16";
        case "1080x1080":
            return "1:1";
        case "1920x1080":
            return "16:9";
        default:
            return "9:16";
    }
}

/** Convert raw Lambda errors into user-friendly messages */
function friendlyError(raw: string): string {
    if (raw.includes("timeout") || raw.includes("Timeout"))
        return "Render timed out. Try a shorter duration or simpler composition.";
    if (raw.includes("ENOMEM") || raw.includes("memory"))
        return "Ran out of memory during render. Try reducing resolution.";
    if (raw.includes("NetworkError") || raw.includes("ECONNREFUSED"))
        return "Network error connecting to AWS. Please try again.";
    if (raw.includes("AccessDenied"))
        return "AWS permission denied. Check your Lambda configuration.";
    if (raw.includes("Too many clients") || raw.includes("connection"))
        return "Database connection overloaded. Retrying automatically.";
    return `Render failed: ${raw.slice(0, 200)}`;
}
