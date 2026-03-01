import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
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
        const command = new PutBucketCorsCommand({
            Bucket: process.env.AWS_S3_BUCKET || 'lumina-assets-prod',
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["GET", "HEAD", "PUT", "POST", "DELETE"],
                        AllowedOrigins: ["*"],
                        ExposeHeaders: ["ETag"],
                        MaxAgeSeconds: 3000
                    }
                ]
            }
        });
        await client.send(command);
        console.log("CORS updated successfully.");
    } catch (e) {
        console.error("Error updating CORS", e);
    }
};
run();
