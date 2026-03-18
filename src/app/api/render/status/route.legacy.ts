import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse";
import { getRenderProgress } from "@remotion/lambda-client";

const REGION = (process.env.REMOTION_AWS_REGION || "us-east-1") as "us-east-1";
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME!;

/**
 * getRenderProgress with exponential backoff for AWS Lambda throttling.
 */
async function getRenderProgressWithBackoff(
    args: Parameters<typeof getRenderProgress>[0]
): ReturnType<typeof getRenderProgress> {
    const MAX_ATTEMPTS = 3;
    const BASE_DELAY_MS = 2_000;
    let lastErr: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            return await getRenderProgress(args);
        } catch (err: unknown) {
            lastErr = err;
            const msg = err instanceof Error ? err.message : String(err);
            const isThrottled =
                msg.includes("Rate Exceeded") ||
                msg.includes("TooManyRequestsException") ||
                msg.includes("Throttling") ||
                msg.includes("429") ||
                msg.includes("no payload");

            if (!isThrottled) throw err;
            if (attempt < MAX_ATTEMPTS - 1) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt);
                console.warn(`[Status] AWS throttled (attempt ${attempt + 1}/${MAX_ATTEMPTS}). Backing off ${delay}ms...`);
                await new Promise((r) => setTimeout(r, delay));
            }
        }
    }
    throw lastErr;
}

/**
 * Reconcile batch status once all jobs are terminal. Broadcasts batch_done via SSE.
 */
async function reconcileBatchStatus(batchId: string, userId?: string) {
    const jobs = await prisma.job.findMany({
        where: { batchId },
        select: { status: true },
    });
    if (jobs.length === 0) return;

    const doneCount = jobs.filter((j) => j.status === "done").length;
    const failedCount = jobs.filter((j) => j.status === "failed").length;
    const allTerminal = doneCount + failedCount === jobs.length;

    console.log(`[Status] Batch ${batchId}: done=${doneCount}, failed=${failedCount}, other=${jobs.length - doneCount - failedCount}`);

    if (allTerminal) {
        const finalStatus = doneCount > 0 ? "done" : "failed";
        await prisma.batch.update({ where: { id: batchId }, data: { status: finalStatus } });
        console.log(`[Status] Batch ${batchId} → ${finalStatus}`);
        if (userId) {
            broadcast(userId, { type: "batch_done", batchId, status: finalStatus });
        }
    }
}

export async function GET(req: NextRequest) {
    // 1. Auth
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const userId = session.user.id;

    // 2. Get jobId from query
    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "missingJobId" }, { status: 400 });

    // 3. Fetch job (verify ownership via batch.userId)
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { batch: { select: { userId: true, id: true } } },
    });

    if (!job || job.batch.userId !== userId) {
        return NextResponse.json({ error: "jobNotFound" }, { status: 404 });
    }

    // 4. Already terminal — short-circuit
    if (job.status === "done" || job.status === "failed") {
        return NextResponse.json({ status: job.status, resultUrl: job.result_url, done: true });
    }

    // 4.5. Handle Queue progression
    if (job.status === "queued") {
        const redis = Redis.fromEnv();
        const pos = await redis.lpos("render_queue", jobId);

        if (pos === 0) {
            const active = (await redis.get<number>("active_renders")) || 0;
            if (active < 10) {
                const poppedJobId = await redis.lpop("render_queue");
                if (poppedJobId === jobId) {
                    await redis.incr("active_renders");

                    // Fire worker in background
                    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/render/worker`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ jobId })
                    }).catch(err => console.error("[Status] Failed to trigger worker:", err));

                    await prisma.job.update({ where: { id: jobId }, data: { status: "rendering" } });
                    return NextResponse.json({ status: "rendering", progress: 0, done: false });
                } else if (poppedJobId) {
                    // Mismatched pop - restore
                    await redis.lpush("render_queue", poppedJobId);
                }
            }
        }

        return NextResponse.json({
            status: "queued",
            queuePosition: pos !== null ? pos : 0,
            done: false
        });
    }

    // 5. Check Lambda progress
    const meta = (job.metadata as Record<string, unknown>) ?? {};
    const renderId = meta.renderId as string | undefined;
    const bucketName = meta.bucketName as string | undefined;
    const jobFunctionName = (meta.functionName as string | undefined) || FUNCTION_NAME;

    if (!renderId || !bucketName) {
        console.log(`[Status] Job ${jobId} — no renderId/bucketName yet (status: ${job.status})`);
        return NextResponse.json({ status: job.status, progress: 0, done: false });
    }

    try {
        const progress = await getRenderProgressWithBackoff({
            renderId,
            bucketName,
            functionName: jobFunctionName,
            region: REGION,
        });

        console.log(`[Status] AWS response for Job ${jobId}: done=${progress.done}, fatal=${progress.fatalErrorEncountered}, progress=${progress.overallProgress}`);

        if (progress.done) {
            const resultUrl = progress.outputFile ?? "";
            await prisma.job.update({ where: { id: jobId }, data: { status: "done", result_url: resultUrl } });
            console.log(`[Status] Job ${jobId} → done ✓`);
            broadcast(userId, { type: "job_update", jobId, status: "done", result_url: resultUrl });
            await reconcileBatchStatus(job.batch.id, userId);
            return NextResponse.json({ status: "done", resultUrl, progress: 1, done: true });
        }

        if (progress.fatalErrorEncountered) {
            const errorMsg = friendlyError(progress.errors?.[0]?.message || "Unknown render error");
            console.log(`[Status] Job ${jobId} render FAILED — ${errorMsg}`);

            const current = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
            if (current?.status !== "failed") {
                await prisma.job.update({ where: { id: jobId }, data: { status: "failed" } });
                console.log(`[Status] Job ${jobId} → failed ✓`);

                // Refund 1 Spark
                const updated = await prisma.user.update({
                    where: { id: userId },
                    data: { credits: { increment: 1 } },
                    select: { credits: true },
                });
                console.log(`[Status] Refunded 1 Spark to user ${userId}`);
                broadcast(userId, { type: "credits_update", credits: updated.credits });
                broadcast(userId, { type: "job_update", jobId, status: "failed" });
            } else {
                console.log(`[Status] Job ${jobId} already failed — skipping refund.`);
            }

            await reconcileBatchStatus(job.batch.id, userId);
            return NextResponse.json({ status: "failed", error: errorMsg, done: true });
        }

        // Still rendering
        return NextResponse.json({ status: "rendering", progress: progress.overallProgress ?? 0, done: false });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Progress check failed";
        if (message.includes("Rate Exceeded") || message.includes("TooManyRequestsException") || message.includes("429") || message.includes("no payload")) {
            console.log(`[Status] Job ${jobId} rate limited by AWS.`);
            return NextResponse.json({ isThrottled: true, done: false, status: "rendering" });
        }
        console.error(`[Status] Error for Job ${jobId}:`, err);
        return NextResponse.json({ error: message, done: false }, { status: 500 });
    }
}

function friendlyError(raw: string): string {
    if (raw.includes("timeout") || raw.includes("Timeout"))
        return "Render timed out. Try a shorter duration or simpler composition.";
    if (raw.includes("ENOMEM") || raw.includes("memory"))
        return "Ran out of memory during render. Try reducing resolution.";
    if (raw.includes("NetworkError") || raw.includes("ECONNREFUSED"))
        return "Network error connecting to AWS. Please try again.";
    return `Render failed: ${raw.slice(0, 200)}`;
}
