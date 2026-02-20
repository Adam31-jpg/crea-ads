import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/batch/[id] — Comprehensive Clean Delete
 * 1. Parse image URLs from batch input_data
 * 2. Delete files from Supabase Storage (best-effort)
 * 3. Delete jobs + batch from DB
 */
export async function DELETE(
    _req: NextRequest,
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

    // Fetch batch (verify ownership)
    const { data: batch, error: fetchError } = await supabase
        .from("batches")
        .select("id, input_data, user_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !batch) {
        return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // 1. Parse image URLs from input_data
    const inputData = batch.input_data as Record<string, unknown>;
    const products = (inputData?.products as Record<string, unknown>[]) ?? [];
    const storagePaths: string[] = [];

    for (const product of products) {
        const images = (product?.images as string[]) ?? [];
        for (const url of images) {
            // Extract storage path from public URL
            // URL format: .../storage/v1/object/public/product-assets/{userId}/draft/filename.ext
            const match = url.match(/product-assets\/(.+)$/);
            if (match) {
                storagePaths.push(match[1]);
            }
        }
    }

    // 2. Delete files from Supabase Storage (best-effort)
    if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
            .from("product-assets")
            .remove(storagePaths);

        if (storageError) {
            console.warn(
                `[Clean Delete] Storage cleanup partial failure for batch ${id}:`,
                storageError.message
            );
            // Continue anyway — pg_cron cleanup catches orphans
        }
    }

    // 3. Delete jobs first, then batch
    // Use .select() to verify rows were actually affected (RLS can silently block)
    const { data: deletedJobs, error: jobsError } = await supabase
        .from("jobs")
        .delete()
        .eq("batch_id", id)
        .select("id");

    if (jobsError) {
        console.warn(`[Clean Delete] Jobs cleanup error for batch ${id}:`, jobsError.message);
    }
    console.log(`[Clean Delete] Deleted ${deletedJobs?.length ?? 0} jobs for batch ${id}`);

    const { data: deletedBatch, error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id");

    if (deleteError) {
        return NextResponse.json(
            { error: `Delete failed: ${deleteError.message}` },
            { status: 500 }
        );
    }

    if (!deletedBatch || deletedBatch.length === 0) {
        return NextResponse.json(
            { error: "Delete failed: batch not found or permission denied. Check RLS policies." },
            { status: 403 }
        );
    }

    return NextResponse.json({ success: true });
}

/**
 * PATCH /api/batch/[id] — Archive / Unarchive toggle
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { is_archived } = body;

    const { error } = await supabase
        .from("batches")
        .update({ is_archived: !!is_archived })
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
