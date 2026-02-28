import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
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
    background_prompt: string;
    [key: string]: unknown;
}

/**
 * POST /api/render/single — Re-render a single job (used by per-job retry)
 * Checks retry_generation before writing results to prevent stale overwrites.
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { jobId, concept, inputData, retryGeneration } = await req.json();
    if (!jobId || !concept || !inputData) {
        return NextResponse.json({ error: "missingJobData" }, { status: 400 });
    }
    if (!SERVE_URL || !FUNCTION_NAME) {
        return NextResponse.json({ error: "lambdaNotConfigured" }, { status: 500 });
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

        // Race-condition guard: only update if generation still matches
        const currentJob = await prisma.job.findUnique({
            where: { id: jobId },
            select: { metadata: true },
        });

        const currentMeta = (currentJob?.metadata as Record<string, unknown>) ?? {};
        const currentGen = (currentMeta.retry_generation as number) || 0;

        if (currentGen !== retryGeneration) {
            return NextResponse.json({ success: false, skipped: true, reason: "Generation mismatch — newer retry in progress" });
        }

        await prisma.job.update({
            where: { id: jobId },
            data: {
                metadata: {
                    concept: typedConcept as unknown as Prisma.InputJsonValue,
                    renderId,
                    bucketName,
                    region: REGION,
                    renderType,
                    retry_generation: retryGeneration,
                } as Prisma.InputJsonValue,
            },
        });

        return NextResponse.json({ success: true, renderId });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown Lambda error";
        await prisma.job.update({
            where: { id: jobId },
            data: { status: "failed" },
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function formatToAspect(format: string): "1:1" | "9:16" | "16:9" | "4:5" {
    switch (format) {
        case "1080x1920": return "9:16";
        case "1080x1080": return "1:1";
        case "1920x1080": return "16:9";
        default: return "9:16";
    }
}
