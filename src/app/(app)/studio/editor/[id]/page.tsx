export const dynamic = 'force-dynamic';

import React from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import RemotionEditor from "@/components/studio/RemotionEditor";

export default async function StudioEditorPage({
    params
}: {
    params: any
}) {
    const p = await Promise.resolve(params);
    const { id: jobId } = p;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return notFound();

    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { batch: true }
    });

    if (!job || job.batch.userId !== userId) return notFound();

    const meta = job.metadata as Record<string, any> || {};
    const inputProps = (meta.inputProps || meta.concept || {}) as any;

    if (!inputProps) return notFound();

    return (
        <div className="h-screen w-full bg-zinc-950 overflow-hidden text-white font-sans">
            <RemotionEditor jobId={jobId} initialProps={inputProps} />
        </div>
    );
}
