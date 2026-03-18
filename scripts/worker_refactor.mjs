import fs from 'fs';
import path from 'path';

const file = 'src/app/api/render/worker/route.ts';
const content = fs.readFileSync(file, 'utf8').split('\n');

const postStartIndex = content.findIndex(line => line.includes('export async function POST(req: NextRequest) {'));
const conceptLogIndex = content.findIndex(line => line.includes('console.log(`[Queue] Concept for JobID ${jobId}:`, JSON.stringify(concept, null, 2));'));
const renderMediaIndex = content.findIndex(line => line.includes('await renderMediaOnLambda({'));
const endIifeIndex = content.findIndex(line => line.includes('console.log(`[Queue] All Lambda triggers dispatched for batch ${batchId}. Awaiting webhooks.`);'));

if (postStartIndex === -1 || conceptLogIndex === -1 || renderMediaIndex === -1 || endIifeIndex === -1) {
    console.error('Boundaries not found!', { postStartIndex, conceptLogIndex, renderMediaIndex, endIifeIndex });
    process.exit(1);
}

const newTop = `export async function POST(req: NextRequest) {
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

const newRenderMedia = `                    const totalFrames = inputData.durationInFrames || 150;
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

const newBottom = `        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(\`[Worker] Uncaught error:\`, e);
        return NextResponse.json({ error: "Internal Render Error" }, { status: 500 });
    } finally {
        const remaining = await redis.decr("active_renders");
        console.log(\`[Worker] Finished. Active renders remaining: \${remaining}\`);
    }
}`;

let finalLines = content.slice(0, postStartIndex);
finalLines.push(newTop);
finalLines = finalLines.concat(content.slice(conceptLogIndex + 1, renderMediaIndex - 1));
finalLines.push(newRenderMedia);

const catchBlockIndex = content.findIndex((line, i) => i > renderMediaIndex && line.includes('} catch (err: unknown) {'));
finalLines = finalLines.concat(content.slice(renderMediaIndex + 13, catchBlockIndex));
finalLines = finalLines.concat(content.slice(catchBlockIndex, endIifeIndex - 2));
finalLines.push(newBottom);

fs.writeFileSync(file, finalLines.join('\\n'));
console.log('Successfully spliced route.ts');
