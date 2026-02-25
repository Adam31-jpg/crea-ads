/**
 * S3 + CloudFront asset upload utility.
 *
 * All generated backgrounds, BRIA composites, Canny renders, and Narrative
 * img2img outputs are persisted here instead of Supabase Storage.
 *
 * Credentials resolution order (first non-empty value wins):
 *   1. AWS_ASSETS_ACCESS_KEY_ID / AWS_ASSETS_SECRET_ACCESS_KEY
 *      — dedicated IAM key with write-only access to the asset bucket (preferred)
 *   2. REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY
 *      — Remotion Lambda key reused for bootstrapping (same region, saves setup)
 *
 * CloudFront URL:
 *   Set AWS_CLOUDFRONT_URL=https://xxxx.cloudfront.net in .env.
 *   If absent, falls back to the direct S3 HTTPS endpoint (still works, just
 *   slower and without the 1 TB/month free egress benefit).
 *
 * Bucket key structure:
 *   backgrounds/{prefix}_{timestamp}_{random}.jpg
 *   e.g.  backgrounds/bria_1716300000000_k4f2x.jpg
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ── Config ────────────────────────────────────────────────────────────────────

const S3_BUCKET =
    process.env.AWS_S3_BUCKET ?? "";

const CF_BASE =
    (process.env.AWS_CLOUDFRONT_URL ?? "").replace(/\/$/, "");

const S3_REGION =
    process.env.AWS_ASSETS_REGION ??
    process.env.REMOTION_AWS_REGION ??
    "us-east-1";

const ACCESS_KEY =
    process.env.AWS_ASSETS_ACCESS_KEY_ID ??
    process.env.REMOTION_AWS_ACCESS_KEY_ID ??
    "";

const SECRET_KEY =
    process.env.AWS_ASSETS_SECRET_ACCESS_KEY ??
    process.env.REMOTION_AWS_SECRET_ACCESS_KEY ??
    "";

// Client is module-level so it's reused across requests (Next.js edge-safe).
const s3Client = new S3Client({
    region: S3_REGION,
    credentials: {
        accessKeyId:     ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
    },
});

// ── Core uploader ─────────────────────────────────────────────────────────────

/**
 * Upload a `Buffer` directly to S3 and return a public URL.
 *
 * @param buffer      Raw image/video bytes
 * @param key         Full S3 object key, e.g. "backgrounds/bria_123.jpg"
 * @param contentType MIME type (default: "image/jpeg")
 * @returns           CloudFront URL (or direct S3 URL as fallback), or null on error
 */
export async function uploadBufferToS3(
    buffer: Buffer,
    key: string,
    contentType: string = "image/jpeg",
): Promise<string | null> {
    if (!S3_BUCKET) {
        console.warn("[S3] AWS_S3_BUCKET is not set — skipping upload.");
        return null;
    }
    if (!ACCESS_KEY || !SECRET_KEY) {
        console.warn("[S3] AWS credentials not configured — skipping upload.");
        return null;
    }

    try {
        await s3Client.send(
            new PutObjectCommand({
                Bucket:             S3_BUCKET,
                Key:                key,
                Body:               buffer,
                ContentType:        contentType,
                // Objects are public-read by default via the bucket policy;
                // CloudFront OAC handles signed reads so we don't set ACL here.
            }),
        );

        const publicUrl = CF_BASE
            ? `${CF_BASE}/${key}`
            : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

        console.log(`[S3] Uploaded → ${publicUrl}`);
        return publicUrl;
    } catch (e) {
        console.error(`[S3] PutObject failed (key: ${key}):`, e);
        return null;
    }
}

/**
 * Download an image from `sourceUrl` and upload it to S3.
 * This is the primary path for all Fal.ai CDN results (BRIA, Canny, Narrative).
 *
 * @param sourceUrl   Fal.ai CDN URL (or any publicly accessible HTTPS URL)
 * @param prefix      Short label used in the key, e.g. "bria" | "canny" | "narrative" | "flux"
 * @param contentType MIME type (default: "image/jpeg")
 * @returns           CloudFront (or S3) public URL, or null on error
 */
export async function uploadUrlToS3(
    sourceUrl: string,
    prefix: string,
    contentType: string = "image/jpeg",
): Promise<string | null> {
    const ext = contentType === "image/jpeg" ? "jpg" : "png";
    const key = `backgrounds/${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    try {
        const res = await fetch(sourceUrl);
        if (!res.ok) {
            console.error(`[S3] Failed to fetch source (${prefix}): ${res.status} ${res.statusText}`);
            return null;
        }
        const arrayBuffer = await res.arrayBuffer();
        const buffer      = Buffer.from(arrayBuffer);

        return uploadBufferToS3(buffer, key, contentType);
    } catch (e) {
        console.error(`[S3] Download+upload failed (${prefix}):`, e);
        return null;
    }
}

/**
 * Upload a base64-encoded image string to S3.
 * Used by the Vertex AI Product Recontext integration which returns
 * `predictions[].bytesBase64Encoded` instead of a CDN URL.
 *
 * @param base64      Raw base64 string (NO data URI prefix)
 * @param prefix      Label for the key, e.g. "vertex"
 * @param contentType MIME type (default: "image/jpeg")
 * @returns           CloudFront (or S3) public URL, or null on error
 */
export async function uploadBase64ToS3(
    base64: string,
    prefix: string,
    contentType: string = "image/jpeg",
): Promise<string | null> {
    const ext = contentType === "image/jpeg" ? "jpg" : "png";
    const key = `backgrounds/${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const buffer = Buffer.from(base64, "base64");
    return uploadBufferToS3(buffer, key, contentType);
}
