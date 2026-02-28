import { NextResponse } from 'next/server';
import { auth, signOut } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteRender } from '@remotion/lambda-client';

export async function POST() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = session.user.id;
        console.log(`[Account Deletion] Initiating deletion for user: ${userId}`);

        // 1. Fetch all jobs to clean up S3 render artifacts
        const jobs = await prisma.job.findMany({
            where: { batch: { userId } },
            select: { id: true, metadata: true },
        });

        if (jobs.length > 0) {
            console.log(`[Account Deletion] Cleaning ${jobs.length} S3 artifacts...`);
            await Promise.allSettled(
                jobs.map(async (job) => {
                    const meta = job.metadata as Record<string, unknown> | null;
                    const renderId = meta?.renderId as string | undefined;
                    const bucketName = meta?.bucketName as string | undefined;
                    const region = meta?.region as string | undefined;
                    if (renderId && bucketName && region) {
                        try {
                            await deleteRender({ bucketName, region: region as any, renderId });
                            console.log(`[Account Deletion] Deleted S3 artifact: ${renderId}`);
                        } catch (err) {
                            console.error(`[Account Deletion] Failed S3 cleanup for ${renderId}:`, err);
                        }
                    }
                })
            );
        }

        // 2. Delete the user from RDS — Prisma FK cascade deletes accounts, sessions, batches, jobs
        await prisma.user.delete({ where: { id: userId } });
        console.log(`[Account Deletion] User ${userId} and all associated data deleted.`);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[Account Deletion] Critical Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
