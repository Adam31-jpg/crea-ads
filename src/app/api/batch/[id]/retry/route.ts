import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/batch/[id]/retry — Re-trigger render for an entire failed batch.
 * 1. Verify ownership
 * 2. Delete old failed jobs
 * 3. Reset batch status to "pending"
 * 4. Forward to /api/render
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const batch = await prisma.batch.findUnique({
        where: { id, userId: session.user.id },
        select: { id: true, metadata: true },
    });

    if (!batch) return NextResponse.json({ error: "batchNotFound" }, { status: 404 });

    // Delete old failed jobs and reset batch status
    await prisma.job.deleteMany({ where: { batchId: id } });
    await prisma.batch.update({ where: { id }, data: { status: "pending" } });

    // Call the render API internally
    const origin = req.nextUrl.origin;
    const batchMeta = (batch.metadata as Record<string, unknown>) ?? {};

    const renderRes = await fetch(`${origin}/api/render`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            cookie: req.headers.get("cookie") || "",
        },
        body: JSON.stringify({ batchId: id, inputData: batchMeta }),
    });

    const renderData = await renderRes.json();
    if (!renderRes.ok) {
        return NextResponse.json({ error: renderData.error || "Retry failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, ...renderData });
}
