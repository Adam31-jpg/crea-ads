import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SPARK_PRICING, type SparkAction } from "@/config/spark-pricing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { action, cost: clientCost } = await req.json();

    // Validate action exists and cost matches server-side config
    const serverCost = SPARK_PRICING[action as SparkAction];
    if (serverCost === undefined || serverCost !== clientCost) {
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }

    if (serverCost === 0) {
        return NextResponse.json({ success: true, remaining: -1 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { credits: true },
    });

    if ((user?.credits ?? 0) < serverCost) {
        return NextResponse.json({ error: "insufficient_sparks" }, { status: 402 });
    }

    const updated = await prisma.user.update({
        where: { id: session.user.id },
        data: { credits: { decrement: serverCost } },
        select: { credits: true },
    });

    return NextResponse.json({ success: true, remaining: updated.credits });
}
