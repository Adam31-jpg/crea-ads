export const dynamic = 'force-dynamic';

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LiveWarRoom from "@/components/dashboard/live-war-room";

export default async function BatchWarRoomPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const batch = await prisma.batch.findUnique({
        where: { id, userId: session.user.id },
        include: {
            jobs: {
                orderBy: { createdAt: "asc" }
            }
        }
    });

    if (!batch) {
        notFound();
    }

    // Convert Date objects to strings for Client Component
    const serializedBatch = {
        ...batch,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString(),
        metadata: batch.metadata as any,
    };

    const serializedJobs = batch.jobs.map(job => ({
        ...job,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        metadata: job.metadata as any,
    }));

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                    System Hub: {batch.id}
                </h1>
                <p className="text-zinc-400">
                    Live Generation Matrix & Queue Monitor
                </p>
            </div>

            <LiveWarRoom batch={serializedBatch} initialJobs={serializedJobs} />
        </div>
    );
}
