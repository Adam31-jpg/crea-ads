import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import pLimit from 'p-limit';
import { z } from 'zod';
import { RemotionPropsSchema } from '../engine/schema/project';

// 1. Configuration
const BATCH_FILE = path.join(process.cwd(), 'src', 'scripts', 'batch-config.json');
const OUTPUT_DIR = path.join(process.cwd(), 'out');
const CONCURRENCY = 1; // Safety limit for local rendering
const COMPOSITION_ID = 'LuxuryPreview'; // The composition we are driving (MasterComposition via Root)

// Schema for the Batch Config Item
const BatchItemSchema = z.object({
    outputName: z.string(),
    props: RemotionPropsSchema
});

const BatchConfigSchema = z.array(BatchItemSchema);

const start = async () => {
    console.log('🚀 Starting Batch Orchestrator...');

    // 2. Ensure Output Directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        console.log(`📂 Creating output directory: ${OUTPUT_DIR}`);
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 3. Read & Validate Config (Dry Run)
    console.log('🔍 Reading & Validating Configuration...');
    const rawConfig = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf-8'));

    const validation = BatchConfigSchema.safeParse(rawConfig);
    if (!validation.success) {
        console.error('❌ Configuration Validation Failed:');
        console.error(JSON.stringify(validation.error.format(), null, 2));
        process.exit(1);
    }

    const items = validation.data;
    console.log(`✅ Configuration Verified. Found ${items.length} items to render.`);

    // 4. Bundle the Project (Once)
    console.log('📦 Bundling Project...');
    const entryPoint = path.join(process.cwd(), 'src', 'engine', 'index.ts');
    const bundleLocation = await bundle({
        entryPoint,
        webpackOverride: (config) => config, // Default
    });

    // 5. Get Composition Data (To verify ID and dimensions if needed)
    const compositions = await getCompositions(bundleLocation, {
        inputProps: items[0].props, // Just to init
    });
    const composition = compositions.find((c) => c.id === COMPOSITION_ID);
    if (!composition) {
        console.error(`❌ Composition ${COMPOSITION_ID} not found in Entry Point.`);
        process.exit(1);
    }

    // 6. Execution Loop (Concurrent)
    const limit = pLimit(CONCURRENCY);
    const results: { name: string; success: boolean; error?: any }[] = [];

    console.log(`🎬 Queueing ${items.length} renders with concurrency: ${CONCURRENCY}`);

    const startTime = Date.now();

    await Promise.all(
        items.map((item, index) =>
            limit(async () => {
                const { outputName, props } = item;
                const fileName = `${outputName}.mp4`;
                const outputPath = path.join(OUTPUT_DIR, fileName);

                console.log(`[${index + 1}/${items.length}] Rendering: ${fileName}...`);

                try {
                    await renderMedia({
                        composition,
                        serveUrl: bundleLocation,
                        codec: 'h264',
                        outputLocation: outputPath,
                        inputProps: props,
                    });
                    console.log(`✅ [${index + 1}/${items.length}] Success: ${fileName}`);
                    results.push({ name: outputName, success: true });
                } catch (err) {
                    console.error(`❌ [${index + 1}/${items.length}] Failed: ${fileName}`, err);
                    results.push({ name: outputName, success: false, error: err });
                }
            })
        )
    );

    // 7. Summary Report
    const durationStr = ((Date.now() - startTime) / 1000).toFixed(1);
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log('\n📊 === BATCH SUMMARY ===');
    console.log(`⏱️  Total Time: ${durationStr}s`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed:  ${failureCount}`);

    if (failureCount > 0) {
        console.log('\nFailed Items:');
        results.filter((r) => !r.success).forEach((r) => console.log(`- ${r.name}: ${r.error}`));
        process.exit(1);
    } else {
        console.log('✨ All renders completed successfully.');
        process.exit(0);
    }
};

start();
