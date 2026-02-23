import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderMediaOnLambda, renderStillOnLambda } from "@remotion/lambda-client";
import { GENERATION_CONFIG } from "@/config/generation.config";

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
}

interface AdConcept {
    index: number;
    type: "image" | "video";
    framework: string;
    headline: string;
    subheadline: string;
    cta: string;
    visualDirection: string;
    colorMood: string;
    emphasis: string;
    logo_position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;
    cameraMotion?: string;
    layoutType?: "converter" | "minimalist";
    background_prompt: string;
    /** AI-generated element positions. Present when Gemini includes the new schema. */
    elements?: RawElement[];
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
}

// ─── Element Builders ────────────────────────────────────────────────────────

/**
 * Hardcoded fallback layout — used when Gemini omits or returns invalid elements.
 * Mirrors the original behaviour so existing renders are unaffected.
 */
function buildFallbackElements(concept: AdConcept): CompositionElement[] {
    const layoutType = concept.layoutType || "converter";
    const elements: CompositionElement[] = [];

    if (layoutType === "converter") {
        elements.push({ id: "hl",  type: "headline",    x: 5,  y: 18, width: 42, align: "left", content: concept.headline });
        if (concept.subheadline) {
            elements.push({ id: "shl", type: "subheadline", x: 5,  y: 38, width: 42, align: "left", content: concept.subheadline });
        }
        elements.push({ id: "cta", type: "cta",         x: 5,  y: 60, width: 38, align: "left", content: concept.cta });
    } else {
        elements.push({ id: "hl",  type: "headline",    x: 50, y: 15, width: 85, align: "center", content: concept.headline });
        if (concept.subheadline) {
            elements.push({ id: "shl", type: "subheadline", x: 50, y: 68, width: 80, align: "center", content: concept.subheadline });
        }
        elements.push({ id: "cta", type: "cta",         x: 50, y: 83, width: 55, align: "center", content: concept.cta });
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
 */
function buildElements(concept: AdConcept): CompositionElement[] {
    const VALID_TYPES = ["headline", "subheadline", "cta"] as const;
    const VALID_ALIGNS = ["left", "center", "right"] as const;

    const contentMap: Record<string, string> = {
        headline:    concept.headline    ?? "",
        subheadline: concept.subheadline ?? "",
        cta:         concept.cta        ?? "",
    };

    if (!Array.isArray(concept.elements) || concept.elements.length === 0) {
        console.log(`[Elements] Gemini did not provide elements — using fallback layout.`);
        return buildFallbackElements(concept);
    }

    try {
        const sanitized: CompositionElement[] = concept.elements
            .filter((el) => el && typeof el === "object")
            .map((el, i): CompositionElement => {
                const type = VALID_TYPES.includes(el.type as typeof VALID_TYPES[number])
                    ? (el.type as typeof VALID_TYPES[number])
                    : "headline";
                const align = VALID_ALIGNS.includes(el.align as typeof VALID_ALIGNS[number])
                    ? (el.align as typeof VALID_ALIGNS[number])
                    : "left";
                return {
                    id:      String(el.id  || `el_${i}`),
                    type,
                    x:       Math.min(95, Math.max(0,  Number(el.x)     || 5)),
                    y:       Math.min(95, Math.max(0,  Number(el.y)     || 10 + i * 25)),
                    width:   el.width != null ? Math.min(90, Math.max(10, Number(el.width))) : undefined,
                    align,
                    content: contentMap[type] ?? "",
                };
            })
            // Only keep elements whose content is non-empty so ghost divs aren't rendered
            .filter((el) => el.content.trim().length > 0);

        if (sanitized.length === 0) {
            console.warn(`[Elements] All sanitized elements were empty — falling back.`);
            return buildFallbackElements(concept);
        }

        console.log(`[Elements] Using ${sanitized.length} AI-generated element(s) from Gemini.`);
        return sanitized;
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

/**
 * Maps BOTH Gemini colorMood tokens AND Studio UI theme IDs to Flux-optimised
 * style keywords prepended to the background_prompt.
 *
 * Keys are normalised to lowercase with hyphens/spaces → underscores so that
 * the UI theme "luxe-sombre" and any Gemini variant both resolve the same key.
 *
 * UI theme IDs (from studio/page.tsx):
 *   luxe-sombre | studio-white | neon | nature | pop | sunset
 * Gemini colorMood tokens:
 *   sunset | midnight | studio_white | electric_neon
 */
const COLOR_MOOD_STYLE_MAP: Record<string, string> = {
    // ── Gemini colorMood tokens ─────────────────────────────────────────────
    sunset:        "golden hour cinematic sunset, warm amber and orange tones, dramatic sky,",
    midnight:      "deep midnight atmosphere, rich dark navy and purple tones, luxury moody lighting,",
    studio_white:  "clean minimalist studio, pure white seamless background, soft diffused professional lighting,",
    electric_neon: "vibrant neon-lit cyberpunk style, electric blues and magentas, glowing neon signs, futuristic atmosphere,",

    // ── Studio UI theme tokens ───────────────────────────────────────────────
    // "luxe-sombre" normalises to "luxe_sombre"
    luxe_sombre:   "dark luxurious atmosphere, deep charcoal and obsidian surfaces, dramatic moody studio lighting,",
    // "studio-white" normalises to "studio_white" — already covered above
    // "neon" maps to the electric_neon visual style
    neon:          "vibrant neon-lit cyberpunk environment, electric blue and magenta glow, futuristic urban atmosphere,",
    // "nature" — organic, botanical, natural light
    nature:        "lush organic botanical setting, soft green foliage, warm natural diffused sunlight, fresh luxury,",
    // "pop" — bold graphic pop-art energy
    pop:           "bold vivid pop-art inspired environment, saturated graphic colors, energetic geometric patterns,",
};

/**
 * Fuses the Fal.ai background_prompt with mood/theme keywords.
 *
 * Priority (highest first):
 *   1. userTheme — explicit user selection in the Studio UI ("nature", "neon", …)
 *   2. colorMood  — AI-generated token from Gemini ("midnight", "studio_white", …)
 *
 * Both are normalised (lowercase, hyphens→underscores) before map lookup so
 * "luxe-sombre", "luxe_sombre", and "Luxe Sombre" all resolve to the same key.
 */
function normaliseThemeKey(s: string): string {
    return s.toLowerCase().replace(/[-\s]+/g, '_');
}

function buildFalPrompt(
    backgroundPrompt: string,
    colorMood?: string,
    userTheme?: string,
): string {
    // Try user theme first (explicit intent), then Gemini colorMood
    const candidates = [userTheme, colorMood].filter(Boolean) as string[];
    for (const candidate of candidates) {
        const prefix = COLOR_MOOD_STYLE_MAP[normaliseThemeKey(candidate)];
        if (prefix) return `${prefix} ${backgroundPrompt}`;
    }
    return backgroundPrompt;
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
    if (
        !rawUrl ||
        rawUrl.trim() === '' ||
        rawUrl.includes('undefined') ||
        rawUrl.includes('null')
    ) {
        console.warn('[Render] Invalid product image URL — using fallback placeholder:', rawUrl);
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

/** Generate a realistic background via Fal.ai and upload it to Supabase Storage */
async function fetchFalAiBackground(prompt: string, supabase: any, format: string): Promise<string | null> {
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

        // Stream to Supabase to save RAM instead of processing base64
        console.log(`[Fal.ai] Success. Streaming Blob to ${GENERATION_CONFIG.STORAGE_BUCKETS.BACKGROUNDS}...`);
        const imageRes = await fetch(imageUrl);
        const imageBlob = await imageRes.blob();

        const fileName = `bg_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
            .from(GENERATION_CONFIG.STORAGE_BUCKETS.BACKGROUNDS)
            .upload(fileName, imageBlob, {
                contentType: "image/jpeg",
                upsert: true
            });

        if (uploadErr) {
            console.error(`[Fal.ai] Supabase upload failed:`, uploadErr);
            return null;
        }

        const { data: publicUrlData } = supabase.storage
            .from(GENERATION_CONFIG.STORAGE_BUCKETS.BACKGROUNDS)
            .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
    } catch (e) {
        console.error(`[Fal.ai] Unexpected error:`, e);
        return null;
    }
}


export async function POST(req: NextRequest) {
    // 1. Auth
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

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

    const concepts: AdConcept[] = inputData.strategy || [];
    const product = inputData.products?.[0] || {};

    // DEBIT-BEFORE-RENDER LOGIC: Consume Sparks
    const cost = (GENERATION_CONFIG.IMAGE_COUNT * GENERATION_CONFIG.IMAGE_SPARK_COST) + (GENERATION_CONFIG.VIDEO_COUNT * GENERATION_CONFIG.VIDEO_SPARK_COST);
    if (cost > 0) {
        const { error: debitError } = await supabase.rpc('decrement_credits', { p_user_id: user.id, p_amount: cost });

        if (debitError) {
            console.error("[Render API] Debit failed:", debitError);
            return NextResponse.json(
                { error: "insufficient_funds" },
                { status: 402 } // Payment Required
            );
        }
    }

    // === CHECKPOINT 1: Payload Intake ===
    console.log(`[Render] Payload received — batchId: ${batchId}, concepts: ${concepts.length}, userId: ${user.id}`);

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

    // 4. Create all job records in a SINGLE insert (1 DB round-trip)
    const jobInserts = concepts.map((concept) => ({
        batch_id: batchId,
        user_id: user.id,
        status: "rendering",
        type: concept.type,
        template_id: formatToCompositionId(inputData.format),
        metadata: {
            concept,
            inputData: { ...inputData, strategy: undefined },
        },
    }));

    // === CHECKPOINT 2: DB Jobs Creation ===
    console.log(`[DB] Attempting to insert ${jobInserts.length} jobs for batch ${batchId}...`);

    let jobs: { id: string }[] | null = null;
    let jobsError: { message: string } | null = null;
    try {
        const result = await withRetry(() =>
            supabase.from("jobs").insert(jobInserts).select("id")
        );
        jobs = result.data as { id: string }[] | null;
        jobsError = result.error;

        if (jobsError) {
            // Full RLS / schema error visibility
            console.error("[DB][RLS ERROR] Full Supabase error object:", JSON.stringify(jobsError, null, 2));
        }
    } catch (insertErr) {
        console.error("[DB][CRITICAL] Exception during job insert:", insertErr);
        return NextResponse.json(
            { error: `DB insert exception: ${insertErr instanceof Error ? insertErr.message : String(insertErr)}` },
            { status: 500 }
        );
    }

    if (jobsError || !jobs) {
        return NextResponse.json(
            { error: `Failed to create jobs: ${jobsError?.message}` },
            { status: 500 }
        );
    }

    console.log(`[DB] Jobs created successfully: [${jobs.map((j) => j.id).join(", ")}]`);

    // 5. Update batch status (single write)
    await withRetry(() =>
        supabase.from("batches").update({ status: "processing" }).eq("id", batchId)
    );

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

            // --- Phase 7: Fal.ai Dynamic Background Generation ---
            let backgroundImageUrl: string | null = null;
            let hasRefunded = false;

            console.log(`[Queue] Concept for JobID ${jobId}:`, JSON.stringify(concept, null, 2));

            if (concept.background_prompt) {
                const fusedPrompt = buildFalPrompt(
                    concept.background_prompt,
                    concept.colorMood,
                    inputData.theme as string | undefined,
                );
                console.log(
                    `[Fal.ai] Fused prompt for JobID ${jobId}` +
                    ` (userTheme: ${inputData.theme ?? "none"}, colorMood: ${concept.colorMood ?? "none"}):` +
                    ` "${fusedPrompt}"`
                );
                backgroundImageUrl = await fetchFalAiBackground(fusedPrompt, supabase, inputData.format as string);
                if (!backgroundImageUrl) {
                    console.log(`[Queue] Triggering atomic 1-Spark refund for failed Fal.ai generation on JobID ${jobId}`);
                    await supabase.rpc('increment_credits', { p_user_id: user.id, p_amount: 1 });
                    hasRefunded = true;
                }
            } else {
                console.warn(`[Queue] No background_prompt generated for JobID ${jobId}, executing 1-Spark refund safety fallback`);
                await supabase.rpc('increment_credits', { p_user_id: user.id, p_amount: 1 });
                hasRefunded = true;
            }

            const inputProps = {
                headlineText: concept.headline,
                subheadlineText: concept.subheadline,
                ctaText: concept.cta,
                productImageUrl: sanitiseProductUrl(
                    product.images?.[product.heroImageIndex ?? 0]
                ),
                backgroundImageUrl: backgroundImageUrl || undefined,
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
                    textPrimary: "#FFFFFF",
                },
                fontFamily: "Bodoni" as const,
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
                            privacy: "public",
                        });

                    console.log(`[AWS] Lambda returned for JobID: ${jobId} — renderId: ${renderId}, bucket: ${bucketName}, url: ${url}`);

                    await withRetry(() =>
                        supabase
                            .from("jobs")
                            .update({
                                status: "done",
                                result_url: url,
                                metadata: {
                                    concept,
                                    renderId,
                                    bucketName,
                                    region: REGION,
                                    renderType: "still",
                                    functionName: FUNCTION_NAME,
                                },
                            })
                            .eq("id", jobId)
                    );
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
                            webhook: webhookConfig,
                            timeoutInMilliseconds: 600000,
                        });

                    console.log(`[AWS] Lambda returned for JobID: ${jobId} — renderId: ${renderId}, bucket: ${bucketName}`);

                    await withRetry(() =>
                        supabase
                            .from("jobs")
                            .update({
                                metadata: {
                                    concept,
                                    renderId,
                                    bucketName,
                                    region: REGION,
                                    renderType: "media",
                                    functionName: FUNCTION_NAME,
                                },
                            })
                            .eq("id", jobId)
                    );
                }
            } catch (err: unknown) {
                console.error(`[CRITICAL ERROR] JobID: ${jobId} (Type: ${concept.type})`, err);

                // --- CRITICAL SAFETY: Refund user if render fails (and wasn't already refunded by Fal.ai logic) ---
                if (!hasRefunded) {
                    console.warn(`[Queue] Remotion render failed for JobID ${jobId}, executing 1-Spark refund safety fallback`);
                    try {
                        await supabase.rpc('increment_credits', { p_user_id: user.id, p_amount: 1 });
                    } catch (refundErr) {
                        console.error(`[CRITICAL] Failed to process refund for JobID ${jobId}:`, refundErr);
                    }
                }

                const message = err instanceof Error ? err.message : "Unknown Lambda error";
                await withRetry(() =>
                    supabase
                        .from("jobs")
                        .update({
                            status: "failed",
                            error_message: friendlyError(message),
                        })
                        .eq("id", jobId)
                );
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
