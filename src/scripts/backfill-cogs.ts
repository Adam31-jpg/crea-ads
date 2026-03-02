import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

async function backfill() {
    console.log("Starting Historical COGS Backfill...");

    // 1. Fetch all jobs
    const jobs = await prisma.job.findMany();
    console.log(`Found ${jobs.length} jobs to process...`);

    let processedCount = 0;
    const batchCostMap: Record<string, Decimal> = {};

    for (const job of jobs) {
        // Only apply cost if it was actually attempted. We charge per attempt,
        // so if status is rendering/processing/done/failed, it costs money.
        // We'll just charge for everything to be safe as "attempts".
        const costVal = job.type === "image" ? new Decimal("0.16") : new Decimal("0.25");

        await prisma.job.update({
            where: { id: job.id },
            data: { cost_usd: costVal },
        });

        // Add to batch running total
        if (!batchCostMap[job.batchId]) {
            batchCostMap[job.batchId] = new Decimal(0);
        }
        batchCostMap[job.batchId] = batchCostMap[job.batchId].add(costVal);

        processedCount++;
    }

    console.log(`Updated ${processedCount} jobs. Now aggregating batch costs...`);

    // 2. Update Batches
    const batchIds = Object.keys(batchCostMap);
    let batchProcessed = 0;

    for (const batchId of batchIds) {
        const totalBatchCost = batchCostMap[batchId];
        await prisma.batch.update({
            where: { id: batchId },
            data: { cost_usd: totalBatchCost },
        });
        batchProcessed++;
    }

    console.log(`Successfully backfilled ${processedCount} jobs and aggregated ${batchProcessed} batches.`);
}

backfill()
    .catch((e) => {
        console.error("Backfill failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
