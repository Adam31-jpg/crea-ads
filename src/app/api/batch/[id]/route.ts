import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteRender } from "@remotion/lambda-client";

/**
 * DELETE /api/batch/[id] — Comprehensive Clean Delete
 * 1. Verify ownership
 * 2. Delete files from S3 via Remotion API (best-effort)
 * 3. Cascade-delete jobs + batch via Prisma (schema has onDelete: Cascade)
 */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Verify ownership
    const batch = await prisma.batch.findUnique({
        where: { id, userId: session.user.id },
        include: { jobs: { select: { id: true, metadata: true } } },
    });

    if (!batch) return NextResponse.json({ error: "batchNotFound" }, { status: 404 });

    // Best-effort AWS S3 cleanup for each job's render artifacts
    const awsCleanups = batch.jobs.map(async (job) => {
        const meta = job.metadata as Record<string, unknown> | null;
        const region = meta?.region as string | undefined;
        const bucketName = meta?.bucketName as string | undefined;
        const renderId = meta?.renderId as string | undefined;
        if (region && bucketName && renderId) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await deleteRender({ region: region as any, bucketName, renderId });
                console.log(`[Clean Delete] Deleted S3 artifacts for renderId: ${renderId}`);
            } catch (err) {
                console.error(`[Clean Delete] Failed S3 cleanup for ${renderId}:`, err);
            }
        }
    });
    await Promise.all(awsCleanups);

    // Cascade delete: jobs are deleted first by Prisma FK cascade, then batch
    await prisma.batch.delete({ where: { id } });
    console.log(`[Clean Delete] Batch ${id} and its ${batch.jobs.length} jobs deleted`);

    return NextResponse.json({ success: true });
}

/**
 * PATCH /api/batch/[id] — Archive / Unarchive toggle
 * Note: `is_archived` is stored in the `metadata` JSON field since the Prisma
 * schema does not have a dedicated column. Alternatively add a Boolean column.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json();
    const is_archived = !!body.is_archived;

    const batch = await prisma.batch.findUnique({ where: { id, userId: session.user.id } });
    if (!batch) return NextResponse.json({ error: "archiveFailed" }, { status: 403 });

    const existingMeta = (batch.metadata as Record<string, unknown>) ?? {};
    await prisma.batch.update({
        where: { id },
        data: { metadata: { ...existingMeta, is_archived } },
    });

    return NextResponse.json({ success: true, is_archived });
}
