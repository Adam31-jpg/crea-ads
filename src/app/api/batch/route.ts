import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/batch — Create a new batch record from the Studio page
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { projectName, inputData } = await req.json();
    if (!inputData) return NextResponse.json({ error: "missingInputData" }, { status: 400 });

    const batch = await prisma.batch.create({
        data: {
            userId: session.user.id,
            status: "pending",
            metadata: {
                project_name: projectName || "Untitled",
                ...inputData,
            },
        },
        select: { id: true },
    });

    return NextResponse.json({ id: batch.id });
}
