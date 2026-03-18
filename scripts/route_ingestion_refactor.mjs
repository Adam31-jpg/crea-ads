import fs from 'fs';

const original = fs.readFileSync('src/app/api/render/route.ts', 'utf8');

let fixed = original.replace(
    'import { NextRequest, NextResponse } from "next/server";',
    'import { NextRequest, NextResponse } from "next/server";\nimport { Redis } from "@upstash/redis";'
);

// Ensure the jobs are inserted as "queued"
fixed = fixed.replace('status: "rendering",', 'status: "queued",');

const matchStr = '    console.log(`[DB] Jobs created successfully';
const splitPoint = fixed.indexOf(matchStr);

if (splitPoint === -1) {
    throw new Error("Could not find split point in route.ts");
}

const topPart = fixed.substring(0, splitPoint);

const newBottom = `    console.log(\`[DB] Jobs created successfully: [\${jobs.map((j) => j.id).join(", ")}]\`);

    const redis = Redis.fromEnv();
    const queueKeys = jobs.map((j) => j.id);
    if (queueKeys.length > 0) {
        await redis.rpush("render_queue", ...queueKeys);
        console.log(\`[Queue] Enqueued \${queueKeys.length} jobs to render_queue for batch \${batchId}\`);
    }
    
    await prisma.batch.update({ where: { id: batchId }, data: { status: "queued" } });

    return NextResponse.json({
        success: true,
        batchId,
        jobIds: queueKeys,
        jobCount: queueKeys.length,
    });
}
`;

fs.writeFileSync('src/app/api/render/route.ts', topPart + newBottom, 'utf8');
console.log('Ingestion route successfully truncated.');
