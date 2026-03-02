/**
 * deploy-site-only.ts
 *
 * Fast redeploy of ONLY the Remotion site bundle to S3.
 * Use this after any change to src/engine/** to push the updated
 * MasterComposition / HeroObject / Root to Lambda WITHOUT re-creating
 * the IAM role, Lambda function, or S3 bucket.
 *
 * After running, copy the new `serveUrl` printed at the end into:
 *   .env → REMOTION_SERVE_URL="<new url>"
 *
 * Usage:
 *   npm run deploy:site
 */
import 'dotenv/config';
import path from 'path';
import { deploySite, getOrCreateBucket } from '@remotion/lambda';
import fs from 'fs';

const REGION = (process.env.REMOTION_AWS_REGION || 'us-east-1') as 'us-east-1';
const SITE_NAME = 'crea-ads-engine-v3';

const main = async () => {
    console.log('📤 Deploying site bundle to S3...');
    console.log(`   Region:    ${REGION}`);
    console.log(`   Site name: ${SITE_NAME}`);
    console.log('   Entry:     src/engine/index.ts\n');

    if (!process.env.REMOTION_AWS_ACCESS_KEY_ID || !process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
        console.error('❌ Missing REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY in .env');
        process.exit(1);
    }

    // Re-use the existing Lambda S3 bucket (same one used by npm run deploy)
    const { bucketName } = await getOrCreateBucket({ region: REGION });
    console.log(`   Bucket:    ${bucketName}`);

    const entryPoint = path.join(process.cwd(), 'src', 'engine', 'index.ts');
    // Nettoyage automatique du cache Webpack local
    const cacheDir = path.join(process.cwd(), 'node_modules', '.cache');
    if (fs.existsSync(cacheDir)) {
        console.log('🧹 Nettoyage du cache local Remotion/Webpack...');
        fs.rmSync(cacheDir, { recursive: true, force: true });
    }
    const { serveUrl } = await deploySite({
        entryPoint,
        bucketName,
        region: REGION,
        siteName: SITE_NAME,
        // Force overwrite of every file so stale cached assets don't survive
        options: {
            onBundleProgress: (progress) => {
                process.stdout.write(`\r   Bundling... ${Math.round(progress * 100)}%`);
            },
            onUploadProgress: ({ totalFiles, filesUploaded }) => {
                process.stdout.write(
                    `\r   Uploading... ${filesUploaded}/${totalFiles} files`
                );
            },
        },
    });

    console.log('\n\n✅ Site bundle deployed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   New REMOTION_SERVE_URL:\n`);
    console.log(`   ${serveUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('👉 Next step: update your .env file:');
    console.log(`   REMOTION_SERVE_URL="${serveUrl}"\n`);
    console.log('   Then restart your dev server (npm run dev).\n');
};

main().catch((err) => {
    console.error('\n❌ Site deploy failed:', err.message || err);
    process.exit(1);
});
