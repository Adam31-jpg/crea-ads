import { S3Client, PutBucketLifecycleConfigurationCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback

// Use the assets region if specified, otherwise fallback to Remotion region
const REGION = process.env.AWS_ASSETS_REGION || process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET;

if (!BUCKET) {
    console.error("❌ Process aborted: AWS_S3_BUCKET is required.");
    process.exit(1);
}

const s3 = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ASSETS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_ASSETS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

async function configureLifecycle() {
    console.log(`Setting up 1-Day TTL Lifecycle Rule on bucket: ${BUCKET}... (Prefix: sandbox-temp/)`);
    try {
        const command = new PutBucketLifecycleConfigurationCommand({
            Bucket: BUCKET,
            LifecycleConfiguration: {
                Rules: [
                    {
                        ID: "PurgeSandboxTempObject",
                        Filter: {
                            Prefix: "sandbox-temp/",
                        },
                        Status: "Enabled",
                        Expiration: {
                            Days: 1, // Minimum allowed by AWS S3 Lifecycle is 1 day
                        },
                    },
                ],
            },
        });

        await s3.send(command);
        console.log("✅ Successfully applied 1-Day TTL Lifecycle Rule to 'sandbox-temp/'.");
    } catch (err: any) {
        console.error("❌ Failed to set lifecycle configuration:", err.message);
        process.exit(1);
    }
}

configureLifecycle();
