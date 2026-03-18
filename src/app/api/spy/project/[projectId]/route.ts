import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { projectId } = await params;

    const storeAnalysis = await prisma.storeAnalysis.findFirst({
        where: { id: projectId, userId: session.user.id },
    });

    if (!storeAnalysis) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const competitors = await prisma.competitorAnalysis.findMany({
        where: { storeAnalysisId: projectId },
        orderBy: { relevanceScore: "desc" },
    });

    const blueprints = await prisma.creativeBlueprint.findMany({
        where: { storeAnalysisId: projectId },
        include: {
            competitorAnalysis: { select: { competitorName: true } },
        },
    });

    const blueprintsWithNames = blueprints.map((b) => ({
        ...b,
        competitorName: b.competitorAnalysis?.competitorName ?? null,
    }));

    const jobs = await prisma.job.findMany({
        where: {
            source: "spy",
            blueprintId: { in: blueprints.map((b) => b.id) },
        },
        select: {
            id: true,
            blueprintId: true,
            status: true,
            result_url: true,
            error_message: true,
        },
    });

    const jobsMapped = jobs.map((j) => ({
        jobId: j.id,
        blueprintId: j.blueprintId ?? "",
        result_url: j.result_url ?? null,
        status: j.status,
    }));

    return NextResponse.json({
        storeAnalysis,
        competitors,
        blueprints: blueprintsWithNames,
        jobs: jobsMapped,
    });
}
