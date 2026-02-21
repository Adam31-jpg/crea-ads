import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRenderProgress } from "@remotion/lambda-client";

const REGION = (process.env.REMOTION_AWS_REGION || "us-east-1") as "us-east-1";
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME!;

/**
 * After marking a single job as done or failed, check if ALL jobs for the
 * same batch are now terminal.  If so, update the batch status once.
 */
async function reconcileBatchStatus(
    supabase: Awaited<ReturnType<typeof createClient>>,
    batchId: string
) {
    const { data: allJobs } = await supabase
        .from("jobs")
        .select("status")
        .eq("batch_id", batchId);

    if (!allJobs || allJobs.length === 0) return;

    const doneCount = allJobs.filter((j) => j.status === "done").length;
    const failedCount = allJobs.filter((j) => j.status === "failed").length;
    const totalCount = allJobs.length;
    const allTerminal = doneCount + failedCount === totalCount;

    console.log(
        `[Status] Batch ${batchId} tally: done=${doneCount}, failed=${failedCount}, other=${totalCount - doneCount - failedCount}`
    );

    if (allTerminal) {
        const finalStatus = doneCount > 0 ? "done" : "failed";
        await supabase
            .from("batches")
            .update({ status: finalStatus })
            .eq("id", batchId);
        console.log(`[Status] Batch ${batchId} → ${finalStatus}`);
    }
}

export async function GET(req: NextRequest) {
    // 1. Auth
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get jobId from query
    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) {
        return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    // 3. Fetch job
    const { data: job, error } = await supabase
        .from("jobs")
        .select("id, status, metadata, batch_id, error_message, result_url")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .single();

    if (error || !job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // 4. If already terminal, return immediately (stop polling)
    if (job.status === "done" || job.status === "failed") {
        return NextResponse.json({
            status: job.status,
            resultUrl: job.result_url,
            error: job.error_message,
            done: true,
        });
    }

    // 5. Check Lambda progress
    const meta = job.metadata as Record<string, unknown> | null;
    const renderId = meta?.renderId as string | undefined;
    const bucketName = meta?.bucketName as string | undefined;
    const jobFunctionName = (meta?.functionName as string | undefined) || FUNCTION_NAME;

    if (!renderId || !bucketName) {
        console.log(`[Status] Job ${jobId} — no renderId/bucketName in metadata yet (status: ${job.status})`);
        return NextResponse.json({
            status: job.status,
            progress: 0,
            done: false,
        });
    }

    console.log(`[Status] Checking AWS for renderId: ${renderId} (bucket: ${bucketName}, region: ${REGION}, fn: ${jobFunctionName})`);

    try {
        console.log(`[Status] EXACT ARGS -> renderId: "${renderId}", bucketName: "${bucketName}", functionName: "${jobFunctionName}", region: "${REGION}"`);
        const progress = await getRenderProgress({
            renderId,
            bucketName,
            functionName: jobFunctionName,
            region: REGION,
        });

        console.log(`[Status] AWS response for Job ${jobId}: done=${progress.done}, fatal=${progress.fatalErrorEncountered}, progress=${progress.overallProgress}`);

        // Render complete
        if (progress.done) {
            const resultUrl = progress.outputFile ?? "";

            console.log(`[Status] Job ${jobId} render complete — resultUrl: ${resultUrl}`);

            console.log(`[Status] DB update attempt — marking Job ${jobId} as done with resultUrl`);
            const { error: updateErr } = await supabase
                .from("jobs")
                .update({
                    status: "done",
                    result_url: resultUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", job.id);

            if (updateErr) {
                console.error(`[Status][DB ERROR] Failed to mark Job ${jobId} as done:`, JSON.stringify(updateErr));
            } else {
                console.log(`[Status] Job ${jobId} → done ✓`);
            }

            // Check if this was the LAST job → update batch
            await reconcileBatchStatus(supabase, job.batch_id);

            return NextResponse.json({
                status: "done",
                resultUrl,
                progress: 1,
                done: true,
            });
        }

        // Render failed
        if (progress.fatalErrorEncountered) {
            const errorMsg = friendlyError(
                progress.errors?.[0]?.message || "Unknown render error"
            );

            console.log(`[Status] Job ${jobId} render FAILED — ${errorMsg}`);

            console.log(`[Status] DB update attempt — marking Job ${jobId} as failed`);
            const { error: updateErr } = await supabase
                .from("jobs")
                .update({
                    status: "failed",
                    error_message: errorMsg,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", job.id);

            if (updateErr) {
                console.error(`[Status][DB ERROR] Failed to mark Job ${jobId} as failed:`, JSON.stringify(updateErr));
            } else {
                console.log(`[Status] Job ${jobId} → failed ✓`);
            }

            // Check if this was the LAST job → update batch
            await reconcileBatchStatus(supabase, job.batch_id);

            return NextResponse.json({
                status: "failed",
                error: errorMsg,
                done: true,
            });
        }

        // Still rendering
        return NextResponse.json({
            status: "rendering",
            progress: progress.overallProgress ?? 0,
            done: false,
        });
    } catch (err: unknown) {
        console.error(`[Status][SEVERE DIAGNOSTIC] getRenderProgress threw an error for Job ${jobId}.`);
        console.error(`[Status][SEVERE DIAGNOSTIC] Type of err:`, typeof err);
        console.error(`[Status][SEVERE DIAGNOSTIC] Is Error:`, err instanceof Error);

        if (err instanceof Error) {
            console.error(`[Status][SEVERE DIAGNOSTIC] Error name:`, err.name);
            console.error(`[Status][SEVERE DIAGNOSTIC] Error message:`, err.message);
            console.error(`[Status][SEVERE DIAGNOSTIC] Error stack:`, err.stack);

            // Check for hidden AWS SDK properties or raw response
            const asAny = err as any;
            if (asAny.response) {
                console.error(`[Status][SEVERE DIAGNOSTIC] Response status:`, asAny.response.status);
                console.error(`[Status][SEVERE DIAGNOSTIC] Response data:`, JSON.stringify(asAny.response.data));
            }
            if (asAny.cause) {
                console.error(`[Status][SEVERE DIAGNOSTIC] Error cause:`, asAny.cause);
            }
            if (asAny.$metadata) {
                console.error(`[Status][SEVERE DIAGNOSTIC] Error $metadata:`, JSON.stringify(asAny.$metadata));
            }
        } else {
            console.error(`[Status][SEVERE DIAGNOSTIC] JSON stringified err:`, JSON.stringify(err, null, 2));
        }

        const message = err instanceof Error ? err.message : "Progress check failed";

        // Handle Rate Limiting gracefully
        if (message.includes("Rate Exceeded") || message.includes("TooManyRequestsException") || message.includes("429") || message.includes("no payload")) {
            console.log(`[Status] Job ${jobId} rate limited by AWS. Passing throttle flag to client.`);
            return NextResponse.json({ isThrottled: true, done: false, status: "rendering" });
        }

        return NextResponse.json({ error: message, done: false }, { status: 500 });
    }
}

/** Convert raw errors to user-friendly messages */
function friendlyError(raw: string): string {
    if (raw.includes("timeout") || raw.includes("Timeout"))
        return "Render timed out. Try a shorter duration or simpler composition.";
    if (raw.includes("ENOMEM") || raw.includes("memory"))
        return "Ran out of memory during render. Try reducing resolution.";
    if (raw.includes("NetworkError") || raw.includes("ECONNREFUSED"))
        return "Network error connecting to AWS. Please try again.";
    return `Render failed: ${raw.slice(0, 200)}`;
}
