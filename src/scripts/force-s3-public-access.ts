import { S3Client, PutPublicAccessBlockCommand } from "@aws-sdk/client-s3";
import 'dotenv/config';

const client = new S3Client({
    region: process.env.AWS_ASSETS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ASSETS_ACCESS_KEY_ID || process.env.REMOTION_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_ASSETS_SECRET_ACCESS_KEY || process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
    }
});

const run = async () => {
    try {
        const command = new PutPublicAccessBlockCommand({
            Bucket: process.env.AWS_S3_BUCKET || 'lumina-assets-prod',
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: false,
                IgnorePublicAcls: false,
                BlockPublicPolicy: false,
                RestrictPublicBuckets: false
            }
        });
        await client.send(command);
        console.log("S3 Block Public Access fully turned OFF.");
    } catch (e) {
        console.error("Error updating S3 Public Access", e);
    }
};
run();
