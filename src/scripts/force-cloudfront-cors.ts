import { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import 'dotenv/config';

const client = new CloudFrontClient({
    region: process.env.AWS_ASSETS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ASSETS_ACCESS_KEY_ID || process.env.REMOTION_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_ASSETS_SECRET_ACCESS_KEY || process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
    }
});

const TARGET_DOMAIN = process.env.AWS_CLOUDFRONT_URL?.replace('https://', '')?.replace('/', '');

const run = async () => {
    try {
        // E1XCB44JW8X6UJ was found in the previous run
        const distId = "E1XCB44JW8X6UJ";

        console.log(`Forcing Response Headers Policy on ID: ${distId}`);

        const configRes = await client.send(new GetDistributionConfigCommand({ Id: distId }));
        const config = configRes.DistributionConfig!;
        const etag = configRes.ETag;

        const CORS_S3_ORIGIN_POLICY_ID = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf";
        const CORS_WITH_PREFLIGHT_POLICY_ID = "5cc3b908-e619-4b99-88e5-2cf7f45965bd";

        if (config.DefaultCacheBehavior) {
            config.DefaultCacheBehavior.OriginRequestPolicyId = CORS_S3_ORIGIN_POLICY_ID;
            // FORCE the response headers policy (overriding whatever is there)
            config.DefaultCacheBehavior.ResponseHeadersPolicyId = CORS_WITH_PREFLIGHT_POLICY_ID;
        }

        await client.send(new UpdateDistributionCommand({
            Id: distId,
            IfMatch: etag,
            DistributionConfig: config
        }));
        console.log("Updated Distribution Behavior forcefully to use CORS-With-Preflight Response Headers.");

        // Invalidate to ensure the new headers are applied immediately
        await client.send(new CreateInvalidationCommand({
            DistributionId: distId,
            InvalidationBatch: {
                CallerReference: Date.now().toString(),
                Paths: { Quantity: 1, Items: ['/*'] }
            }
        }));
        console.log("Invalidation triggered successfully.");

    } catch (e) {
        console.error("Error updating CloudFront", e);
    }
};
run();
