import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/job/[id]/retry — Retry a single failed/stuck job
 * Increments retry_generation in metadata for race-condition safety.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: jobId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Fetch the job (verify ownership via batch)
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { batch: { select: { userId: true, id: true, metadata: true } } },
    });

    if (!job || job.batch.userId !== session.user.id) {
        return NextResponse.json({ error: "jobNotFound" }, { status: 404 });
    }

    if (job.status === "done") {
        return NextResponse.json({ error: "jobCompleted" }, { status: 400 });
    }

    // Bump retry_generation for race-condition safety
    const currentMeta = (job.metadata as Record<string, unknown>) || {};
    const prevGeneration = (currentMeta.retry_generation as number) || 0;
    const newGeneration = prevGeneration + 1;

    await prisma.job.update({
        where: { id: jobId },
        data: {
            status: "rendering",
            result_url: null,
            metadata: { ...currentMeta, retry_generation: newGeneration },
        },
    });

    // Re-trigger the render for this single job
    const origin = req.nextUrl.origin;
    const batchMeta = job.batch.metadata as Record<string, unknown> | null;

    const renderRes = await fetch(`${origin}/api/render/single`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            cookie: req.headers.get("cookie") || "",
        },
        body: JSON.stringify({
            jobId,
            batchId: job.batch.id,
            concept: currentMeta.concept,
            inputData: batchMeta?.input_data,
            retryGeneration: newGeneration,
        }),
    });

    const renderData = await renderRes.json();
    if (!renderRes.ok) return NextResponse.json({ error: renderData.error || "Job retry failed" }, { status: 500 });

    return NextResponse.json({ success: true, jobId, retryGeneration: newGeneration });
}
