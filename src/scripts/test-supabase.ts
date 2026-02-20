/**
 * Test Supabase Connection
 * Verifies that we can connect to Supabase and write a "pending" job row.
 *
 * Usage: npx tsx src/scripts/test-supabase.ts
 */
import 'dotenv/config';
import { createAdminClient } from '../lib/supabase/admin';

const test = async () => {
    console.log('🔌 Connecting to Supabase...');

    const supabase = createAdminClient();

    // 1. Test Read: Check if the "jobs" table is accessible
    console.log('📖 Testing READ access on "jobs" table...');
    const { data: readData, error: readError } = await supabase
        .from('jobs')
        .select('id')
        .limit(1);

    if (readError) {
        console.error('❌ READ failed:', readError.message);
        console.error('   Hint: Make sure the "jobs" table exists. Run the SQL in db/schema.sql first.');
        process.exit(1);
    }
    console.log(`✅ READ success. Found ${readData?.length ?? 0} existing row(s).`);

    // 2. Test Write: Insert a mock "pending" job
    console.log('✍️  Testing WRITE access (inserting a mock pending job)...');
    const mockJob = {
        status: 'pending',
        type: 'video',
        template_id: 'LuxuryPreview',
        metadata: {
            headlineText: 'Supabase Connection Test',
            productImageUrl: 'https://example.com/test.png',
        },
    };

    const { data: writeData, error: writeError } = await supabase
        .from('jobs')
        .insert(mockJob)
        .select()
        .single();

    if (writeError) {
        console.error('❌ WRITE failed:', writeError.message);
        console.error('   Hint: Check RLS policies. You may need to temporarily disable RLS for scripted inserts,');
        console.error('   or use a Supabase Service Role Key instead of the anon key.');
        process.exit(1);
    }

    console.log(`✅ WRITE success. Created job with ID: ${writeData.id}`);

    // 3. Clean up: Delete the test row
    console.log('🧹 Cleaning up test row...');
    const { error: deleteError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', writeData.id);

    if (deleteError) {
        console.warn('⚠️  Cleanup failed (non-critical):', deleteError.message);
    } else {
        console.log('✅ Cleanup done.');
    }

    // Summary
    console.log('\n📊 === SUPABASE CONNECTION TEST ===');
    console.log('✅ READ:  OK');
    console.log('✅ WRITE: OK');
    console.log('✅ All checks passed. Supabase is ready.');
    process.exit(0);
};

test();
