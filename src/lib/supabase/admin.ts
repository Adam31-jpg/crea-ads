/**
 * Standalone Supabase client for Node.js scripts (non-Next.js context).
 * Uses @supabase/supabase-js directly (no SSR/cookies needed).
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error(
            '❌ Missing Supabase credentials.\n' +
            '   Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.\n' +
            '   Copy .env.example to .env and fill in your values.'
        );
    }

    return createSupabaseClient(url, key);
}
