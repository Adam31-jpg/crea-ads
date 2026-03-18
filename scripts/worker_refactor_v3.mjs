import fs from 'fs';
import { execSync } from 'child_process';

// Get pristine file from Git, avoiding PowerShell ">" UTF-16 corruption
const originalBuffer = execSync('git show HEAD:src/app/api/render/route.ts');
const original = originalBuffer.toString('utf8');

// 1. Replace Top
const topRegex = /export async function POST\(req: NextRequest\) \{[\s\S]*?console\.log\(`\[Queue\] Concept for JobID \$\{jobId\}:`, JSON\.stringify\(concept, null, 2\)\);/;
const replaceTop = `import { Redis } from "@upstash/redis";

export async function POST(req: NextRequest) {
    const redis = Redis.fromEnv();
    try {
        const { jobId } = await req.json();
        if (!jobId) return NextResponse.json({ error: "missingJobId" }, { status: 400 });

        const SERVE_URL = process.env.REMOTION_SERVE_URL;
        const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME;
        if (!SERVE_URL || !FUNCTION_NAME) return NextResponse.json({ error: "lambdaNotConfigured" }, { status: 500 });

        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: { batch: { select: { userId: true, id: true } } }
        });

        if (!job) return NextResponse.json({ error: "jobNotFound" }, { status: 404 });

        const userId = job.batch.userId;
        const batchId = job.batch.id;
        const meta = job.metadata;
        const concept = meta.concept;
        const inputData = meta.inputData;
        const product = inputData.products?.[0] || {};
        
        const layoutType = concept.layoutType || 'converter';
        const elements = buildElements(concept);

        const rawImageArray = Array.isArray(product.images)
            ? product.images.slice(0, 3)
            : [];
        const heroUrl = sanitiseProductUrl(
            product.images?.[product.heroImageIndex || 0]
        );
        const productImageUrls = rawImageArray.length > 0
                ? rawImageArray.map((u) => sanitiseProductUrl(u))
                : [heroUrl];

        let backgroundImageUrl = null;
        let hideHeroObject = false;
        let hasRefunded = false;
        const isBundle = productImageUrls.length > 1;

        console.log(\`[Worker] Started processing JobID \${jobId} (Type: \${concept.type})\`);`;

// 2. Replace Media Render Block
const mediaRegex = /const \{ renderId, bucketName \} =\s+await renderMediaOnLambda\(\{[\s\S]*?timeoutInMilliseconds: 600000,\s+\}\);/;
const replaceMedia = `const totalFrames = inputData.durationInFrames || 150;
                    const computedFramesPerLambda = Math.max(1, Math.ceil(totalFrames / 3));
                    console.log(\`[AWS] Lambda config: concurrency 3, chunk size \${computedFramesPerLambda} for JobID \${jobId}\`);

                    const { renderId, bucketName } =
                        await renderMediaOnLambda({
                            region: REGION,
                            functionName: FUNCTION_NAME,
                            serveUrl: SERVE_URL,
                            composition: formatToCompositionId(inputData.format),
                            inputProps,
                            codec: "h264",
                            framesPerLambda: computedFramesPerLambda,
                            concurrencyPerLambda: 3,
                            logLevel: "verbose",
                            webhook: webhookConfig,
                            timeoutInMilliseconds: 600000,
                        });`;

// 3. Replace Bottom Catch Block
const bottomCatchEndRegex = /        \}\r?\n        console\.log\(\`\[Queue\] All Lambda triggers dispatched for batch \$\{batchId\}\. Awaiting webhooks\.\`\);\r?\n    \}\)\(\);\r?\n\r?\n    return NextResponse\.json\(\{[\s\S]*?\}\);/m;

const replaceBottom = `        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(\`[Worker] Uncaught error:\`, e);
        return NextResponse.json({ error: "Internal Render Error" }, { status: 500 });
    } finally {
        const remaining = await redis.decr("active_renders");
        console.log(\`[Worker] Finished. Active renders remaining: \${remaining}\`);
    }`;

let fixed = original;
fixed = fixed.replace(topRegex, replaceTop);
fixed = fixed.replace(mediaRegex, replaceMedia);
fixed = fixed.replace(bottomCatchEndRegex, replaceBottom);

// Now save back to route.ts
fs.writeFileSync('src/app/api/render/worker/route.ts', fixed, 'utf8');
console.log('Worker replaced via Regex with valid UTF8');
