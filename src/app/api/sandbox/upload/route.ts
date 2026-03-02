import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.AWS_ASSETS_REGION || process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET!;

const s3 = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ASSETS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_ASSETS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

export async function POST(req: NextRequest) {
    const session = await auth();
    // In admin sandbox, we might not always have a strict user session in local dev,
    // but we'll leave auth check intact since Admin is authenticated.
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    if (!BUCKET) {
        return NextResponse.json({ error: "storageNotConfigured" }, { status: 500 });
    }

    const { filename, contentType } = await req.json();
    if (!filename || !contentType) {
        return NextResponse.json({ error: "missingFields" }, { status: 400 });
    }

    const ext = filename.split(".").pop();
    // Epic 18: Store in sandbox-temp/ so the 1-Day TTL bucket lifecycle policy purges it automatically.
    const key = `sandbox-temp/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
    });

    try {
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
        const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

        console.log(`[Sandbox Upload] Presigned PUT for key=${key} contentType=${contentType}`);
        return NextResponse.json({ presignedUrl, publicUrl, key });
    } catch (err) {
        console.error("[Sandbox Upload] Failed to generate presigned URL:", err);
        return NextResponse.json({ error: "presignFailed" }, { status: 500 });
    }
}
