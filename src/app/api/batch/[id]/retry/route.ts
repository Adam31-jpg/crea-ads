import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/batch/[id]/retry — Re-trigger render for a failed batch
 * 1. Fetch batch input_data
 * 2. Reset batch status to pending
 * 3. Forward to /api/render logic
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createClient();

    // Auth
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch batch
    const { data: batch, error: fetchError } = await supabase
        .from("batches")
        .select("id, input_data, user_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !batch) {
        return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Reset batch status
    await supabase.from("batches").update({ status: "pending" }).eq("id", id);

    // Delete old failed jobs for this batch
    await supabase.from("jobs").delete().eq("batch_id", id);

    // Call the render API internally
    const origin = req.nextUrl.origin;
    const renderRes = await fetch(`${origin}/api/render`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            cookie: req.headers.get("cookie") || "",
        },
        body: JSON.stringify({
            batchId: batch.id,
            inputData: batch.input_data,
        }),
    });

    const renderData = await renderRes.json();

    if (!renderRes.ok) {
        return NextResponse.json(
            { error: renderData.error || "Retry failed" },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        jobId: renderData.jobId,
        renderId: renderData.renderId,
    });
}
