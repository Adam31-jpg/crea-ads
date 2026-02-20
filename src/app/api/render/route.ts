import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderMediaOnLambda, renderStillOnLambda } from "@remotion/lambda-client";

const REGION = (process.env.REMOTION_AWS_REGION || "us-east-1") as "us-east-1";
const SERVE_URL = process.env.REMOTION_SERVE_URL!;
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME!;
const COMPOSITION_ID = "LuxuryPreview";

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

export async function POST(req: NextRequest) {
    // 1. Auth
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const { batchId, inputData } = await req.json();
    if (!batchId || !inputData) {
        return NextResponse.json(
            { error: "Missing batchId or inputData" },
            { status: 400 }
        );
    }

    // 3. Validate env
    if (!SERVE_URL || !FUNCTION_NAME) {
        return NextResponse.json(
            {
                error: "Lambda not configured. Set REMOTION_SERVE_URL and REMOTION_FUNCTION_NAME.",
            },
            { status: 500 }
        );
    }

    const concepts: AdConcept[] = inputData.strategy || [];
    const product = inputData.products?.[0] || {};

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

    // 4. Create all job records in a single insert
    const jobInserts = concepts.map((concept) => ({
        batch_id: batchId,
        user_id: user.id,
        status: "rendering",
        type: concept.type,
        template_id: COMPOSITION_ID,
        metadata: {
            concept,
            inputData: { ...inputData, strategy: undefined }, // Don't duplicate full strategy
        },
    }));

    const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .insert(jobInserts)
        .select("id");

    if (jobsError || !jobs) {
        return NextResponse.json(
            { error: `Failed to create jobs: ${jobsError?.message}` },
            { status: 500 }
        );
    }

    // 5. Update batch status
    await supabase.from("batches").update({ status: "processing" }).eq("id", batchId);

    // 6. Trigger all renders concurrently (non-blocking)
    const renderPromises = concepts.map(async (concept, i) => {
        const jobId = jobs[i].id;

        const inputProps = {
            headlineText: concept.headline,
            subheadlineText: concept.subheadline,
            ctaText: concept.cta,
            productImageUrl: product.images?.[product.heroImageIndex ?? 0] || "",
            colors: {
                primary: inputData.accentColor || "#D4AF37",
                secondary: "#1E1E2E",
                accent: inputData.accentColor || "#D4AF37",
                background: "#0A0A0F",
                textPrimary: "#FFFFFF",
            },
            fontFamily: "Bodoni" as const,
            glassmorphism: { enabled: true, intensity: 0.6, blur: 12 },
            camera: { zoomStart: 1, zoomEnd: 1.15, orbitSpeed: 0.4, panX: 0 },
            enableMotionBlur: false,
            layout: {
                aspectRatio: formatToAspect(inputData.format),
                safePadding: 40,
                contentScale: 1,
            },
        };

        try {
            if (concept.type === "image") {
                // Render still (PNG)
                const { renderId, bucketName } = await renderStillOnLambda({
                    region: REGION,
                    functionName: FUNCTION_NAME,
                    serveUrl: SERVE_URL,
                    composition: COMPOSITION_ID,
                    inputProps,
                    imageFormat: "png",
                    privacy: "public",
                });

                await supabase
                    .from("jobs")
                    .update({
                        metadata: { concept, renderId, bucketName, region: REGION, renderType: "still" },
                    })
                    .eq("id", jobId);
            } else {
                // Render video (MP4)
                const { renderId, bucketName } = await renderMediaOnLambda({
                    region: REGION,
                    functionName: FUNCTION_NAME,
                    serveUrl: SERVE_URL,
                    composition: COMPOSITION_ID,
                    inputProps,
                    codec: "h264",
                    framesPerLambda: 20,
                });

                await supabase
                    .from("jobs")
                    .update({
                        metadata: { concept, renderId, bucketName, region: REGION, renderType: "media" },
                    })
                    .eq("id", jobId);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown Lambda error";
            await supabase
                .from("jobs")
                .update({ status: "failed", error_message: friendlyError(message) })
                .eq("id", jobId);
        }
    });

    // Fire all renders concurrently — don't await them blocking the response
    Promise.allSettled(renderPromises).then(async () => {
        // Check if all jobs are done/failed → update batch status
        const { data: allJobs } = await supabase
            .from("jobs")
            .select("status")
            .eq("batch_id", batchId);

        if (allJobs) {
            const allTerminal = allJobs.every(
                (j) => j.status === "done" || j.status === "failed"
            );
            if (allTerminal) {
                const anyDone = allJobs.some((j) => j.status === "done");
                await supabase
                    .from("batches")
                    .update({ status: anyDone ? "done" : "failed" })
                    .eq("id", batchId);
            }
        }
    });

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
    return `Render failed: ${raw.slice(0, 200)}`;
}
