import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateWebhookSignature, deleteRender } from "@remotion/lambda-client";
import type { WebhookPayload } from "@remotion/lambda-client";

// Get appropriate key to bypass RLS in the background webhook
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

/**
 * Reconcile Batch Status Helper (from status/route.ts logic)
 * Updates a batch to "done" or "failed" if all its jobs are now terminal.
 */
async function reconcileBatchStatus(batchId: string) {
    const { data: allJobs } = await supabaseAdmin
        .from("jobs")
        .select("status")
        .eq("batch_id", batchId);

    if (!allJobs || allJobs.length === 0) return;

    const doneCount = allJobs.filter((j) => j.status === "done").length;
    const failedCount = allJobs.filter((j) => j.status === "failed").length;
    const totalCount = allJobs.length;
    const allTerminal = doneCount + failedCount === totalCount;

    if (allTerminal) {
        const finalStatus = doneCount > 0 ? "done" : "failed";
        await supabaseAdmin
            .from("batches")
            .update({ status: finalStatus })
            .eq("id", batchId);
        console.log(`[Webhook] Batch ${batchId} reconciled → ${finalStatus}`);
    }
}

export async function POST(req: NextRequest) {
    try {
        const payloadStr = await req.text();
        const signatureHeader = req.headers.get("x-remotion-signature");
        const secret = process.env.WEBHOOK_SECRET;

        // 1. Secret validation
        if (!secret) {
            console.error("[Webhook] WEBHOOK_SECRET is not defined.");
            return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
        }

        if (!signatureHeader) {
            return NextResponse.json({ error: "Missing signature header" }, { status: 400 });
        }

        // 2. Signature Validation
        try {
            validateWebhookSignature({
                secret,
                body: payloadStr,
                signatureHeader,
            });
        } catch (e) {
            const errName = e instanceof Error ? e.name : String(e);
            console.error("[Webhook] Invalid signature:", errName);
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        // 3. Parse JSON safely now that it is validated
        const body = JSON.parse(payloadStr) as any;
        const renderId = body.renderId;
        const type = body.type; // "success" | "error" | "timeout"

        console.log(`[Webhook] Received validated ${type} payload for renderId: ${renderId}`);

        // 4. Find the Job in our DB matching this renderId metadata

        // Note: metadata->>renderId is the JSONB operator to find it
        const { data: job, error: jobErr } = await supabaseAdmin
            .from("jobs")
            .select("id, batch_id, metadata")
            .eq("metadata->>renderId", renderId)
            .single();

        if (jobErr || !job) {
            console.error(`[Webhook] Could not find job with renderId ${renderId} in DB. Error:`, jobErr);
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        // 5. Apply Status Update
        if (type === "success") {
            const outputUrl = body.outputUrl || "";

            const { error: updateErr } = await supabaseAdmin
                .from("jobs")
                .update({
                    status: "done",
                    result_url: outputUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", job.id);

            if (updateErr) {
                console.error(`[Webhook] Failed to mark Job ${job.id} as done:`, updateErr);
                return NextResponse.json({ error: "DB Update Failed" }, { status: 500 });
            }
            console.log(`[Webhook] Job ${job.id} marked as done.`);
        } else if (type === "error" || type === "timeout") {
            let errorMsg = "Unknown Webhook Error";
            if (type === "error" && body.errors && body.errors.length > 0) {
                errorMsg = body.errors[0].message;
            } else if (type === "timeout") {
                errorMsg = "AWS Lambda Timeout triggered via Webhook";
            }

            // Clean up S3 storage asynchronously to save costs
            const region = job.metadata?.region;
            const bucketName = job.metadata?.bucketName;
            if (region && bucketName) {
                try {
                    await deleteRender({ region, bucketName, renderId });
                    console.log(`[Webhook] Cleaned up partial S3 files for failed render ${renderId}`);
                } catch (cleanupErr) {
                    console.error(`[Webhook] Failed S3 cleanup for ${renderId}:`, cleanupErr);
                }
            }

            const { error: updateErr } = await supabaseAdmin
                .from("jobs")
                .update({
                    status: "failed",
                    error_message: errorMsg,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", job.id);

            if (updateErr) {
                console.error(`[Webhook] Failed to mark Job ${job.id} as failed:`, updateErr);
                return NextResponse.json({ error: "DB Update Failed" }, { status: 500 });
            }
            console.log(`[Webhook] Job ${job.id} marked as failed. Reason: ${errorMsg}`);
        } else {
            console.warn(`[Webhook] Received unknown type for renderId: ${renderId}`, type);
        }

        // 6. Reconcile the overall Batch
        await reconcileBatchStatus(job.batch_id);

        return NextResponse.json({ success: true, processed: renderId });
    } catch (err) {
        console.error("[Webhook] Unhandled error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
