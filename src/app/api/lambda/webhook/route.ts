import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse";
import { validateWebhookSignature, deleteRender } from "@remotion/lambda-client";
import type { WebhookPayload } from "@remotion/lambda-client";

/**
 * Reconcile Batch Status: once all jobs for a batch are terminal (done/failed),
 * flip the batch status accordingly and notify the batch owner via SSE.
 */
async function reconcileBatchStatus(batchId: string) {
    const jobs = await prisma.job.findMany({
        where: { batchId },
        select: { status: true },
    });

    if (jobs.length === 0) return;

    const doneCount = jobs.filter((j) => j.status === "done").length;
    const failedCount = jobs.filter((j) => j.status === "failed").length;
    const allTerminal = doneCount + failedCount === jobs.length;

    if (allTerminal) {
        const finalStatus = doneCount > 0 ? "done" : "failed";
        await prisma.batch.update({ where: { id: batchId }, data: { status: finalStatus } });
        console.log(`[Webhook] Batch ${batchId} reconciled → ${finalStatus}`);
    }
}

export async function POST(req: NextRequest) {
    try {
        const payloadStr = await req.text();
        const signatureHeader = req.headers.get("x-remotion-signature");
        const secret = process.env.WEBHOOK_SECRET;

        // 1. Config guard
        if (!secret) {
            console.error("[Webhook] WEBHOOK_SECRET is not defined.");
            return NextResponse.json({ error: "configError" }, { status: 500 });
        }
        if (!signatureHeader) {
            return NextResponse.json({ error: "missingSignature" }, { status: 400 });
        }

        // 2. Signature validation
        try {
            validateWebhookSignature({ secret, body: payloadStr, signatureHeader });
        } catch (e) {
            console.error("[Webhook] Invalid signature:", e instanceof Error ? e.name : e);
            return NextResponse.json({ error: "invalidSignature" }, { status: 401 });
        }

        // 3. Parse payload
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = JSON.parse(payloadStr) as any;
        const renderId = body.renderId as string;
        const type = body.type as "success" | "error" | "timeout";

        console.log(`[Webhook] Received validated ${type} payload for renderId: ${renderId}`);

        // 4. Find matching job by renderId stored in metadata JSONB
        //    Prisma raw query needed for JSON path comparison.
        const jobs = await prisma.$queryRaw<{ id: string; batchId: string; metadata: unknown }[]>`
            SELECT id, "batchId", metadata
            FROM jobs
            WHERE metadata->>'renderId' = ${renderId}
            LIMIT 1
        `;

        if (jobs.length === 0) {
            console.error(`[Webhook] No job found with renderId ${renderId}`);
            return NextResponse.json({ error: "jobNotFound" }, { status: 404 });
        }

        const job = jobs[0];
        const meta = job.metadata as Record<string, unknown> | null;

        // Fetch the batch to get userId for SSE broadcast
        const batch = await prisma.batch.findUnique({
            where: { id: job.batchId },
            select: { userId: true },
        });
        const userId = batch?.userId;

        // 5. Apply status update
        if (type === "success") {
            const outputUrl = (body.outputUrl as string) || "";
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "done", result_url: outputUrl },
            });
            console.log(`[Webhook] Job ${job.id} marked as done.`);

            // Push job_update event to client
            if (userId) {
                broadcast(userId, { type: "job_update", jobId: job.id, status: "done", result_url: outputUrl });
            }

        } else if (type === "error" || type === "timeout") {
            const errorMsg =
                type === "timeout"
                    ? "AWS Lambda Timeout triggered via Webhook"
                    : (body.errors?.[0]?.message as string) || "Unknown Webhook Error";

            // Best-effort S3 cleanup for partial renders
            const region = meta?.region as string | undefined;
            const bucketName = meta?.bucketName as string | undefined;
            if (region && bucketName) {
                try {
                    await deleteRender({ region: region as any, bucketName, renderId });
                    console.log(`[Webhook] Cleaned up partial S3 files for failed render ${renderId}`);
                } catch (err) {
                    console.error(`[Webhook] Failed S3 cleanup for ${renderId}:`, err);
                }
            }

            // Only mark as failed if not already failed (idempotency guard)
            const current = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
            if (current && current.status !== "failed") {
                await prisma.job.update({ where: { id: job.id }, data: { status: "failed" } });
                console.log(`[Webhook] Job ${job.id} marked as failed. Reason: ${errorMsg}`);

                // Refund 1 Spark
                if (userId) {
                    const updated = await prisma.user.update({
                        where: { id: userId },
                        data: { credits: { increment: 1 } },
                        select: { credits: true },
                    });
                    console.log(`[Webhook] Refunded 1 Spark to user ${userId}`);
                    broadcast(userId, { type: "credits_update", credits: updated.credits });
                    broadcast(userId, { type: "job_update", jobId: job.id, status: "failed" });
                }
            } else {
                console.log(`[Webhook] Job ${job.id} already failed — skipping refund.`);
            }
        }

        // 6. Reconcile batch
        await reconcileBatchStatus(job.batchId);

        return NextResponse.json({ success: true, processed: renderId });
    } catch (err) {
        console.error("[Webhook] Unhandled error:", err);
        return NextResponse.json({ error: "internalError" }, { status: 500 });
    }
}
