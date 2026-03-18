import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ blueprintId: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { blueprintId } = await params;
    const body = await req.json();

    // Verify ownership through storeAnalysis
    const blueprint = await prisma.creativeBlueprint.findFirst({
        where: { id: blueprintId },
        include: { competitorAnalysis: { include: { storeAnalysis: { select: { userId: true } } } } },
    });
    if (!blueprint) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const allowedFields: Record<string, unknown> = {};
    if (body.customProductImageUrl !== undefined) allowedFields.customProductImageUrl = body.customProductImageUrl;
    if (body.reproductionPrompt !== undefined) allowedFields.reproductionPrompt = body.reproductionPrompt;
    if (body.aspectRatio !== undefined) allowedFields.aspectRatio = body.aspectRatio;

    await prisma.creativeBlueprint.update({
        where: { id: blueprintId },
        data: allowedFields,
    });

    return NextResponse.json({ status: 'ok' });
}
