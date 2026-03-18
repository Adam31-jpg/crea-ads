import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fal } from "@fal-ai/client";
import { uploadUrlToS3 } from "@/lib/s3";
import { broadcast } from "@/lib/sse";
import { GENERATION_CONFIG } from "@/config/generation.config";

fal.config({ credentials: process.env.FAL_KEY });

const SPARK_COSTS: Record<string, number> = {
    "1K": GENERATION_CONFIG.IMAGE_SPARK_COST,
    "2K": GENERATION_CONFIG.IMAGE_2K_SPARK_COST,
    "4K": GENERATION_CONFIG.IMAGE_4K_SPARK_COST,
};

async function generateWithRetry(
    prompt: string,
    imageUrl: string,
    aspectRatio: string,
    resolution: string,
    maxRetries = 3,
): Promise<{ url: string } | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
                input: {
                    prompt,
                    image_urls: [imageUrl],
                    aspect_ratio: aspectRatio as "9:16" | "1:1" | "16:9" | "4:5",
                    resolution: resolution as "1K" | "2K" | "4K",
                    output_format: "png",
                    safety_tolerance: "4",
                    limit_generations: true,
                },
            });
            const images = (result.data as { images?: Array<{ url: string }> })?.images;
            if (images && images[0]?.url) {
                return { url: images[0].url };
            }
        } catch (err) {
            console.error(`[spy/generate] Fal.ai attempt ${attempt} failed:`, err);
            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, attempt * 1000));
            }
        }
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;

        const body = await req.json();
        const { blueprintId, productImageUrl, resolution = "1K" } = body as {
            blueprintId: string;
            productImageUrl: string;
            resolution?: "1K" | "2K" | "4K";
        };

        if (!blueprintId || !productImageUrl) {
            return NextResponse.json(
                { error: "blueprintId and productImageUrl are required" },
                { status: 400 },
            );
        }

        if (!process.env.FAL_KEY) {
            return NextResponse.json({ error: "configuration_error" }, { status: 500 });
        }

        const blueprint = await prisma.creativeBlueprint.findUnique({
            where: { id: blueprintId },
        });

        if (!blueprint) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const sparkCost = SPARK_COSTS[resolution] ?? 1;

        // Check user Sparks
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.credits < sparkCost) {
            return NextResponse.json({ error: "insufficient_sparks" }, { status: 402 });
        }

        // Debit Sparks before generation
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: sparkCost } },
        });

        // Find or create a spy batch for this user session
        let batch = await prisma.batch.findFirst({
            where: { userId, status: "spy_active" },
            orderBy: { createdAt: "desc" },
        });

        if (!batch) {
            batch = await prisma.batch.create({
                data: {
                    userId,
                    status: "spy_active",
                    metadata: { source: "spy" },
                },
            });
        }

        // Create Job record
        const job = await prisma.job.create({
            data: {
                batchId: batch.id,
                userId,
                status: "rendering",
                type: "image",
                blueprintId,
                source: "spy",
                metadata: { resolution, blueprintId, productImageUrl },
            },
        });

        // Update blueprint status
        await prisma.creativeBlueprint.update({
            where: { id: blueprintId },
            data: { status: "generating" },
        });

        broadcast(userId, { type: "job_update", jobId: job.id, status: "rendering" });

        // Generate via Fal.ai with retries
        const falResult = await generateWithRetry(
            blueprint.reproductionPrompt,
            productImageUrl,
            blueprint.aspectRatio,
            resolution,
        );

        if (!falResult) {
            // Refund Sparks
            await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: sparkCost } },
            });
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "failed", error_message: "generation_failed" },
            });
            await prisma.creativeBlueprint.update({
                where: { id: blueprintId },
                data: { status: "failed" },
            });
            broadcast(userId, { type: "job_update", jobId: job.id, status: "failed", error: "generation_failed" });
            return NextResponse.json({ error: "generation_failed", jobId: job.id }, { status: 500 });
        }

        // Upload to S3 (with fallback to Fal.ai temp URL if S3 fails)
        let resultUrl = await uploadUrlToS3(falResult.url, "nanob2", "image/png");

        if (!resultUrl) {
            // Retry S3 upload up to 3 times
            for (let i = 0; i < 2; i++) {
                resultUrl = await uploadUrlToS3(falResult.url, "nanob2", "image/png");
                if (resultUrl) break;
            }
            if (!resultUrl) {
                // Use Fal.ai temp URL as fallback with warning
                resultUrl = falResult.url;
                broadcast(userId, {
                    type: "job_update",
                    jobId: job.id,
                    status: "done",
                    result_url: resultUrl,
                    warning: "upload_failed",
                });
            }
        }

        // Update records
        await prisma.job.update({
            where: { id: job.id },
            data: { status: "done", result_url: resultUrl },
        });
        await prisma.creativeBlueprint.update({
            where: { id: blueprintId },
            data: { status: "done" },
        });

        broadcast(userId, { type: "job_update", jobId: job.id, status: "done", result_url: resultUrl });

        // Broadcast updated credit balance
        const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
        if (updatedUser) {
            broadcast(userId, { type: "credits_update", credits: updatedUser.credits });
        }

        return NextResponse.json({ jobId: job.id, result_url: resultUrl });
    } catch (err) {
        console.error("[spy/generate]", err);
        return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
}
