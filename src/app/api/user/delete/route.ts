import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteRender } from '@remotion/lambda/client';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();

        // Ensure the user is authenticated and requesting their own deletion
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[Account Deletion] Initiating deletion for user: ${user.id}`);

        // 1. Fetch all their jobs to delete Remotion S3 assets
        const { data: jobs } = await supabase
            .from('jobs')
            .select(`
            id,
            render_id,
            bucket_name,
            aws_region,
            batch_id,
            batches!inner(user_id)
        `)
            .eq('batches.user_id', user.id);

        if (jobs && jobs.length > 0) {
            console.log(`[Account Deletion] Found ${jobs.length} jobs to clean from S3.`);

            // We clean them up asynchronously in chunks to prevent timeout
            // But for safety, we try to wait for them
            const cleanupPromises = jobs.map(async (job: any) => {
                if (job.render_id && job.bucket_name && job.aws_region) {
                    try {
                        await deleteRender({
                            bucketName: job.bucket_name,
                            region: job.aws_region as any,
                            renderId: job.render_id,
                        });
                        console.log(`[Account Deletion] Deleted S3 artifact for render: ${job.render_id}`);
                    } catch (s3Err) {
                        console.error(`[Account Deletion] Failed to delete S3 artifact for ${job.render_id}:`, s3Err);
                        // We don't throw here, we want to proceed with DB deletion anyway
                    }
                }
            });

            await Promise.allSettled(cleanupPromises);
        }

        // 2. Delete the User from Supabase Auth
        // We must use the Admin client to delete users
        const supabaseAdmin = createAdminClient();

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
            console.error(`[Account Deletion] Failed to delete auth user ${user.id}:`, deleteError);
            return NextResponse.json({ error: "Echec de la suppression du compte." }, { status: 500 });
        }

        // Because of Postgres ON DELETE CASCADE constraints:
        // Deleting the auth.user will automatically delete rows in 'profiles', 'batches', and consequently 'jobs'.

        console.log(`[Account Deletion] Successfully deleted user ${user.id} and all associated data.`);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error(`[Account Deletion] Critical Error:`, err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
