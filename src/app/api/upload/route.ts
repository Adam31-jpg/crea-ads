import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// .env uses AWS_ASSETS_REGION for the asset S3 bucket.
// Fall back to AWS_REGION (Remotion) then hard-coded default.
const REGION = process.env.AWS_ASSETS_REGION || process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET!;

// Explicit credentials so the SDK never silently picks up the wrong IAM context.
const s3 = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ASSETS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_ASSETS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

/**
 * POST /api/upload
 * Returns a presigned S3 PUT URL so the client can upload directly to S3.
 * Body: { filename: string, contentType: string }
 *
 * ⚠️  ACL is intentionally OMITTED — modern S3 buckets have Object Ownership =
 * BucketOwnerEnforced which rejects any ACL header with AccessControlListNotSupported,
 * causing an opaque silent failure. Public read access must be set via bucket policy.
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    if (!BUCKET) {
        console.error("[Upload] AWS_S3_BUCKET not configured");
        return NextResponse.json({ error: "storageNotConfigured" }, { status: 500 });
    }

    const { filename, contentType } = await req.json();
    if (!filename || !contentType) {
        return NextResponse.json({ error: "missingFields" }, { status: 400 });
    }

    const ext = filename.split(".").pop();
    const key = `${session.user.id}/assets/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // ACL is NOT included — omitting it prevents AccessControlListNotSupported
    // on buckets with BucketOwnerEnforced Object Ownership (default since Apr 2023).
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
    });

    try {
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
        const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

        console.log(`[Upload] Presigned PUT for key=${key} contentType=${contentType}`);
        return NextResponse.json({ presignedUrl, publicUrl, key });
    } catch (err) {
        console.error("[Upload] Failed to generate presigned URL:", err);
        return NextResponse.json({ error: "presignFailed" }, { status: 500 });
    }
}
