import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { projectId } = await params;
    const body = await req.json();
    const allowedFields: Record<string, unknown> = {};
    if (body.productImageUrl !== undefined) allowedFields.productImageUrl = body.productImageUrl;
    const updated = await prisma.storeAnalysis.update({
        where: { id: projectId, userId: session.user.id },
        data: allowedFields,
    });
    return NextResponse.json({ status: 'ok', productImageUrl: updated.productImageUrl });
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { projectId } = await params;
    const storeAnalysis = await prisma.storeAnalysis.findFirst({
        where: { id: projectId, userId: session.user.id },
    });
    if (!storeAnalysis) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const competitors = await prisma.competitorAnalysis.findMany({
        where: { storeAnalysisId: projectId },
        orderBy: { relevanceScore: 'desc' },
    });
    const blueprintsRaw = await prisma.creativeBlueprint.findMany({
        where: { storeAnalysisId: projectId },
        include: { competitorAnalysis: { select: { competitorName: true } } },
        orderBy: { createdAt: 'asc' }, // stable: first-extracted stays first
    });
    const jobs = await prisma.job.findMany({
        where: { source: 'spy', blueprintId: { in: blueprintsRaw.map((b) => b.id) } },
        select: { id: true, blueprintId: true, status: true, result_url: true, error_message: true },
    });
    // Generated blueprints first, then createdAt asc — stable and predictable
    const doneIds = new Set(jobs.filter((j) => j.status === 'done').map((j) => j.blueprintId));
    const blueprintsSorted = [...blueprintsRaw].sort((a, b) => {
        const aDone = doneIds.has(a.id) ? 1 : 0;
        const bDone = doneIds.has(b.id) ? 1 : 0;
        return bDone - aDone; // within each group, createdAt asc preserved
    });
    const blueprintsWithNames = blueprintsSorted.map((b) => ({
        ...b,
        competitorName: b.competitorAnalysis?.competitorName ?? null,
    }));
    const jobsMapped = jobs.map((j) => ({
        jobId: j.id,
        blueprintId: j.blueprintId ?? '',
        result_url: j.result_url ?? null,
        status: j.status,
    }));
    return NextResponse.json({ storeAnalysis, competitors, blueprints: blueprintsWithNames, jobs: jobsMapped });
}
