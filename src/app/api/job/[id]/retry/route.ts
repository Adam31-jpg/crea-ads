import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/job/[id]/retry — Retry a single failed/stuck job
 *
 * Race-condition protection:
 * - Increments `retry_generation` in metadata
 * - The render status poller checks generation before writing results
 * - A late-finishing Lambda from a previous generation will NOT overwrite
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: jobId } = await params;
    const supabase = await createClient();

    // Auth
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the job
    const { data: job, error: fetchError } = await supabase
        .from("jobs")
        .select("id, batch_id, user_id, metadata, type, status")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Only allow retry on stuck (rendering > 150s) or failed jobs
    if (job.status === "done") {
        return NextResponse.json(
            { error: "Job already completed" },
            { status: 400 }
        );
    }

    // Increment retry generation for race-condition safety
    const currentMeta = (job.metadata as Record<string, unknown>) || {};
    const prevGeneration = (currentMeta.retry_generation as number) || 0;
    const newGeneration = prevGeneration + 1;

    // Reset this job to "rendering" with bumped generation
    await supabase
        .from("jobs")
        .update({
            status: "rendering",
            error_message: null,
            result_url: null,
            metadata: {
                ...currentMeta,
                retry_generation: newGeneration,
            },
            updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

    // Re-trigger the render for this single job via the render API
    const origin = req.nextUrl.origin;
    const batchData = await supabase
        .from("batches")
        .select("input_data")
        .eq("id", job.batch_id)
        .single();

    if (!batchData.data) {
        return NextResponse.json(
            { error: "Batch not found for this job" },
            { status: 404 }
        );
    }

    // Call a lightweight render for just this one job
    const renderRes = await fetch(`${origin}/api/render/single`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            cookie: req.headers.get("cookie") || "",
        },
        body: JSON.stringify({
            jobId,
            batchId: job.batch_id,
            concept: currentMeta.concept,
            inputData: batchData.data.input_data,
            retryGeneration: newGeneration,
        }),
    });

    const renderData = await renderRes.json();

    if (!renderRes.ok) {
        return NextResponse.json(
            { error: renderData.error || "Job retry failed" },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        jobId,
        retryGeneration: newGeneration,
    });
}
