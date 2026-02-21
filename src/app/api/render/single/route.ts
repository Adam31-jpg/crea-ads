import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderMediaOnLambda, renderStillOnLambda } from "@remotion/lambda-client";

const REGION = (process.env.REMOTION_AWS_REGION || "us-east-1") as "us-east-1";
const SERVE_URL = process.env.REMOTION_SERVE_URL!;
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME!;
const COMPOSITION_ID = "LuxuryPreview";

interface AdConcept {
    type: "image" | "video";
    headline: string;
    subheadline: string;
    cta: string;
    colorMood: string;
    emphasis: string;
    [key: string]: unknown;
}

/**
 * POST /api/render/single — Render a single job (used by per-job retry)
 *
 * Checks retry_generation before writing results to prevent stale overwrites.
 */
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { jobId, concept, inputData, retryGeneration } = await req.json();

    if (!jobId || !concept || !inputData) {
        return NextResponse.json(
            { error: "missingJobData" },
            { status: 400 }
        );
    }

    if (!SERVE_URL || !FUNCTION_NAME) {
        return NextResponse.json(
            { error: "lambdaNotConfigured" },
            { status: 500 }
        );
    }

    const product = inputData.products?.[0] || {};
    const typedConcept = concept as AdConcept;

    const inputProps = {
        headlineText: typedConcept.headline,
        subheadlineText: typedConcept.subheadline,
        ctaText: typedConcept.cta,
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
        let renderId: string;
        let bucketName: string;
        let renderType: string;

        if (typedConcept.type === "image") {
            const result = await renderStillOnLambda({
                region: REGION,
                functionName: FUNCTION_NAME,
                serveUrl: SERVE_URL,
                composition: COMPOSITION_ID,
                inputProps,
                imageFormat: "png",
                privacy: "public",
            });
            renderId = result.renderId;
            bucketName = result.bucketName;
            renderType = "still";
        } else {
            const result = await renderMediaOnLambda({
                region: REGION,
                functionName: FUNCTION_NAME,
                serveUrl: SERVE_URL,
                composition: COMPOSITION_ID,
                inputProps,
                codec: "h264",
                framesPerLambda: 20,
            });
            renderId = result.renderId;
            bucketName = result.bucketName;
            renderType = "media";
        }

        // GENERATION CHECK: only update if generation matches
        // This prevents a late Lambda from overwriting a newer retry
        const { data: currentJob } = await supabase
            .from("jobs")
            .select("metadata")
            .eq("id", jobId)
            .single();

        const currentGen =
            ((currentJob?.metadata as Record<string, unknown>)?.retry_generation as number) || 0;

        if (currentGen !== retryGeneration) {
            // A newer retry has already been triggered — discard this one
            return NextResponse.json({
                success: false,
                skipped: true,
                reason: "Generation mismatch — newer retry in progress",
            });
        }

        await supabase
            .from("jobs")
            .update({
                metadata: {
                    concept: typedConcept,
                    renderId,
                    bucketName,
                    region: REGION,
                    renderType,
                    retry_generation: retryGeneration,
                },
            })
            .eq("id", jobId);

        return NextResponse.json({ success: true, renderId });
    } catch (err: unknown) {
        const message =
            err instanceof Error ? err.message : "Unknown Lambda error";

        await supabase
            .from("jobs")
            .update({
                status: "failed",
                error_message: friendlyError(message),
            })
            .eq("id", jobId);

        return NextResponse.json({ error: message }, { status: 500 });
    }
}

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

function friendlyError(raw: string): string {
    if (raw.includes("timeout") || raw.includes("Timeout"))
        return "Render timed out. Try a shorter duration.";
    if (raw.includes("ENOMEM") || raw.includes("memory"))
        return "Ran out of memory. Try reducing resolution.";
    if (raw.includes("NetworkError") || raw.includes("ECONNREFUSED"))
        return "Network error. Please try again.";
    if (raw.includes("AccessDenied"))
        return "AWS permission denied. Check Lambda config.";
    return `Render failed: ${raw.slice(0, 200)}`;
}
