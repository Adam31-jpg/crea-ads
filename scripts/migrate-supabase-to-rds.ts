/**
 * Supabase → AWS RDS Migration Script
 *
 * Reads users (profiles), batches, and jobs from Supabase Postgres,
 * then upsertes them into AWS RDS via Prisma.
 *
 * Run with:
 *   npx tsx scripts/migrate-supabase-to-rds.ts
 *
 * Prerequisites:
 *   1. Both SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL must be set in .env.
 *   2. The RDS schema must already be applied (prisma db push or prisma migrate deploy).
 *   3. Run from within a network that can reach the RDS endpoint (e.g., via AWS SSM,
 *      GitHub Actions with the RDS SG open, or a bastion host).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const BATCH_SIZE = 100;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("🚀 Starting Supabase → RDS migration...\n");

    // ── Step 1: Migrate Users (from profiles table) ────────────────────────────
    console.log("📦 Fetching users from Supabase profiles...");
    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, credits, created_at");

    if (profilesError) {
        throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    // Also try to get password hashes from auth.users via service role
    // Note: Supabase encrypts passwords with Argon2 — bcrypt format differs.
    // If you need to preserve passwords, export them separately via Supabase Dashboard.
    // For OAuth (Google) users, password_hash will remain null.

    const userBatches = chunk(profiles!, BATCH_SIZE);
    let userCount = 0;

    for (const batch of userBatches) {
        await prisma.user.createMany({
            data: batch.map((p: any) => ({
                id: p.id,                          // Preserve original UUID
                email: p.email,
                name: p.full_name || null,
                image: p.avatar_url || null,
                credits: typeof p.credits === "number" ? p.credits : 10,
                createdAt: p.created_at ? new Date(p.created_at) : new Date(),
            })),
            skipDuplicates: true,                          // Idempotent — safe to re-run
        });
        userCount += batch.length;
        console.log(`  ✓ ${userCount}/${profiles!.length} users migrated`);
    }
    console.log(`✅ Users: ${userCount} rows migrated.\n`);

    // ── Step 2: Migrate Batches ────────────────────────────────────────────────
    console.log("📦 Fetching batches from Supabase...");
    const { data: batches, error: batchesError } = await supabase
        .from("batches")
        .select("id, user_id, status, input_data, created_at");

    if (batchesError) {
        throw new Error(`Failed to fetch batches: ${batchesError.message}`);
    }

    const batchBatches = chunk(batches!, BATCH_SIZE);
    let batchCount = 0;

    for (const batch of batchBatches) {
        await prisma.batch.createMany({
            data: batch.map((b: any) => ({
                id: b.id,
                userId: b.user_id,
                status: b.status || "done",
                metadata: b.input_data || null,
                createdAt: b.created_at ? new Date(b.created_at) : new Date(),
            })),
            skipDuplicates: true,
        });
        batchCount += batch.length;
        console.log(`  ✓ ${batchCount}/${batches!.length} batches migrated`);
    }
    console.log(`✅ Batches: ${batchCount} rows migrated.\n`);

    // ── Step 3: Migrate Jobs ───────────────────────────────────────────────────
    console.log("📦 Fetching jobs from Supabase...");
    const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, batch_id, status, result_url, metadata, created_at");

    if (jobsError) {
        throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
    }

    const jobBatches = chunk(jobs!, BATCH_SIZE);
    let jobCount = 0;

    for (const batch of jobBatches) {
        await prisma.job.createMany({
            data: batch.map((j: any) => ({
                id: j.id,
                batchId: j.batch_id,
                status: j.status || "done",
                result_url: j.result_url || null,
                metadata: j.metadata || null,
                createdAt: j.created_at ? new Date(j.created_at) : new Date(),
            })),
            skipDuplicates: true,
        });
        jobCount += batch.length;
        console.log(`  ✓ ${jobCount}/${jobs!.length} jobs migrated`);
    }
    console.log(`✅ Jobs: ${jobCount} rows migrated.\n`);

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log("📊 Migration Summary:");
    console.log(`   Users:   ${userCount}`);
    console.log(`   Batches: ${batchCount}`);
    console.log(`   Jobs:    ${jobCount}`);
    console.log("\n✅ Migration complete! Your data is now in AWS RDS.");
    console.log("   You can verify with: npx prisma@5 studio");
}

main()
    .catch((err) => {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
