import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderMediaOnLambda, renderStillOnLambda } from "@remotion/lambda-client";

const REGION = (process.env.REMOTION_AWS_REGION || "us-east-1") as "us-east-1";
const SERVE_URL = process.env.REMOTION_SERVE_URL!;
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME!;
const COMPOSITION_ID = "LuxuryPreview";

// Delay between sequential Lambda triggers to avoid AWS burst limits (ms)
const STAGGER_MS = 1500;

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
        });
    }

    // 4. Create all job records in a SINGLE insert (1 DB round-trip)
    const jobInserts = concepts.map((concept) => ({
        batch_id: batchId,
        user_id: user.id,
        status: "rendering",
        type: concept.type,
        template_id: COMPOSITION_ID,
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

            const inputProps = {
                headlineText: concept.headline,
                subheadlineText: concept.subheadline,
                ctaText: concept.cta,
                productImageUrl:
                    product.images?.[product.heroImageIndex ?? 0] || "",
                colors: {
                    primary: inputData.accentColor || "#D4AF37",
                    secondary: "#1E1E2E",
                    accent: inputData.accentColor || "#D4AF37",
                    background: "#0A0A0F",
                    textPrimary: "#FFFFFF",
                },
                fontFamily: "Bodoni" as const,
                glassmorphism: { enabled: true, intensity: 0.6, blur: 12 },
                camera: {
                    zoomStart: 1,
                    zoomEnd: 1.15,
                    orbitSpeed: 0.4,
                    panX: 0,
                },
                enableMotionBlur: false,
                layout: {
                    aspectRatio: formatToAspect(inputData.format),
                    safePadding: 40,
                    contentScale: 1,
                },
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
                            composition: COMPOSITION_ID,
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
                            composition: COMPOSITION_ID,
                            inputProps,
                            codec: "h264",
                            framesPerLambda: 20,
                            webhook: webhookConfig,
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
