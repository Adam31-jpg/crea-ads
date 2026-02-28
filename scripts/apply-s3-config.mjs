// scripts/apply-s3-config.mjs
// Run with: node scripts/apply-s3-config.mjs
// Applies CORS policy and public-read bucket policy to lumina-assets-prod.

import { S3Client, PutBucketCorsCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv needed — just read the file)
const envPath = resolve(__dirname, "../.env");
const envLines = readFileSync(envPath, "utf-8").split("\n");
const env = {};
for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = val;
}

const REGION = env.AWS_ASSETS_REGION || env.AWS_REGION || "us-east-1";
const BUCKET = env.AWS_S3_BUCKET || "lumina-assets-prod";
const ACCESS_KEY = env.AWS_ASSETS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = env.AWS_ASSETS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;

if (!ACCESS_KEY || !SECRET_KEY) {
    console.error("❌ Missing AWS credentials in .env");
    process.exit(1);
}

const s3 = new S3Client({
    region: REGION,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

console.log(`🪣  Bucket: ${BUCKET} (${REGION})`);
console.log(`🔑  Key:    ${ACCESS_KEY.slice(0, 8)}...`);

// ── 1. CORS Policy ──────────────────────────────────────────────────────────
try {
    await s3.send(new PutBucketCorsCommand({
        Bucket: BUCKET,
        CORSConfiguration: {
            CORSRules: [{
                AllowedHeaders: ["*"],
                AllowedMethods: ["PUT", "GET", "HEAD"],
                AllowedOrigins: [
                    "http://localhost:3000",
                    "https://lumina.so",
                    "https://*.lumina.so",
                    "https://*.vercel.app",
                ],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 3600,
            }],
        },
    }));
    console.log("✅  CORS policy applied");
} catch (e) {
    console.error("❌  CORS failed:", e.message);
}

// ── 2. Bucket Policy (public read for GET) ─────────────────────────────────
// NOTE: This requires that "Block all public access" is DISABLED on the bucket
// in the AWS console first! Settings → Permissions → Block public access → Off.
try {
    await s3.send(new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Sid: "PublicReadGetObject",
                Effect: "Allow",
                Principal: "*",
                Action: "s3:GetObject",
                Resource: `arn:aws:s3:::${BUCKET}/*`,
            }],
        }),
    }));
    console.log("✅  Bucket policy applied (public GetObject)");
} catch (e) {
    if (e.message.includes("Access Denied") || e.message.includes("PublicAccessBlock")) {
        console.error("❌  Bucket policy blocked — you must first DISABLE \"Block all public access\" in the AWS console:");
        console.error("     S3 → lumina-assets-prod → Permissions → Block public access → Edit → Uncheck all → Save");
    } else {
        console.error("❌  Bucket policy failed:", e.message);
    }
}

console.log("\nDone. Re-test the upload now.");
