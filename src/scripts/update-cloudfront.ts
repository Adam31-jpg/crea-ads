import { CloudFrontClient, ListDistributionsCommand, CreateInvalidationCommand, GetDistributionConfigCommand, UpdateDistributionCommand } from "@aws-sdk/client-cloudfront";
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
        const listRes = await client.send(new ListDistributionsCommand({}));
        const dist = listRes.DistributionList?.Items?.find(d => d.DomainName === TARGET_DOMAIN || d.Aliases?.Items?.includes(TARGET_DOMAIN!));

        if (!dist) {
            console.error("Could not find distribution for domain:", TARGET_DOMAIN);
            return;
        }

        const distId = dist.Id!;
        console.log(`Found Distribution ID: ${distId}`);

        // 1. Invalidate Cache
        const invRes = await client.send(new CreateInvalidationCommand({
            DistributionId: distId,
            InvalidationBatch: {
                CallerReference: Date.now().toString(),
                Paths: {
                    Quantity: 1,
                    Items: ['/*']
                }
            }
        }));
        console.log(`Invalidation started: ${invRes.Invalidation?.Id}`);

        // 2. Update CORS Origin Request Policy
        const configRes = await client.send(new GetDistributionConfigCommand({ Id: distId }));
        const config = configRes.DistributionConfig!;
        const etag = configRes.ETag;

        // AWS Managed Policy: CORS-S3Origin
        const CORS_S3_ORIGIN_POLICY_ID = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf";
        // AWS Managed Policy for Caching Optimized (Optional but usually default)

        let updated = false;
        if (config.DefaultCacheBehavior) {
            if (config.DefaultCacheBehavior.OriginRequestPolicyId !== CORS_S3_ORIGIN_POLICY_ID) {
                config.DefaultCacheBehavior.OriginRequestPolicyId = CORS_S3_ORIGIN_POLICY_ID;
                updated = true;
            }
            if (!config.DefaultCacheBehavior.ResponseHeadersPolicyId) {
                // AWS Managed Policy: CORS-With-Preflight (Optional but good)
                config.DefaultCacheBehavior.ResponseHeadersPolicyId = "5cc3b908-e619-4b99-88e5-2cf7f45965bd";
                updated = true;
            }
        }

        if (updated) {
            await client.send(new UpdateDistributionCommand({
                Id: distId,
                IfMatch: etag,
                DistributionConfig: config
            }));
            console.log("Updated Distribution Behavior to use CORS-S3Origin policy.");
        } else {
            console.log("Distribution already has the correct CORS policies.");
        }

    } catch (e) {
        console.error("Error updating CloudFront", e);
    }
};
run();
