/**
 * Deploy Lambda Script
 * Automates the full Remotion Lambda setup:
 *   1. Creates IAM role (remotion-lambda-role) with Lambda trust policy
 *   2. Attaches the Remotion role policy (from CLI output)
 *   3. Ensures S3 bucket exists
 *   4. Deploys site bundle
 *   5. Deploys Lambda function (with retry for IAM propagation)
 *
 * Usage: npm run deploy
 */
import 'dotenv/config';
import path from 'path';
import { execSync } from 'child_process';
import {
    deploySite,
    deployFunction,
    getOrCreateBucket,
} from '@remotion/lambda';
import {
    IAMClient,
    GetRoleCommand,
    CreateRoleCommand,
    PutRolePolicyCommand,
    GetRolePolicyCommand,
} from '@aws-sdk/client-iam';
import {
    S3Client,
    PutBucketLifecycleConfigurationCommand
} from '@aws-sdk/client-s3';

// --- Configuration ---
const REGION = (process.env.REMOTION_AWS_REGION || 'us-east-1') as 'us-east-1';
const MEMORY_SIZE = 2048;
const TIMEOUT = 600;
const DISK_SIZE = 2048;
const ROLE_NAME = 'remotion-lambda-role';
const INLINE_POLICY_NAME = 'remotion-lambda-inline-policy';

// --- IAM Client ---
const iam = new IAMClient({
    region: REGION,
    credentials: {
        accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
    },
});

const LAMBDA_TRUST_POLICY = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
        {
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
            Action: 'sts:AssumeRole',
        },
    ],
});

/**
 * Gets the Remotion role policy JSON by running the CLI command.
 */
function getRemotionRolePolicy(): string {
    try {
        const output = execSync('npx remotion lambda policies role', {
            encoding: 'utf-8',
            timeout: 30000,
        }).trim();
        // The CLI outputs raw JSON — validate it parses
        JSON.parse(output);
        return output;
    } catch (err) {
        console.error('   ⚠️  Could not get policy from Remotion CLI. Using fallback.');
        // Fallback: minimal policy that covers Lambda + S3 + CloudWatch
        return JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: [
                        's3:*',
                        'logs:*',
                        'iam:PassRole',
                        'lambda:*',
                        'cloudwatch:*',
                        'sqs:*',
                        'servicequotas:*',
                    ],
                    Resource: '*',
                },
            ],
        });
    }
}

/**
 * Ensures the IAM role exists with correct trust policy and permissions.
 */
async function ensureRoleExists(): Promise<void> {
    // 1. Check if role exists
    try {
        await iam.send(new GetRoleCommand({ RoleName: ROLE_NAME }));
        console.log(`   ✅ IAM Role "${ROLE_NAME}" already exists.`);
    } catch (err: any) {
        if (err.name === 'NoSuchEntityException') {
            console.log(`   ⏳ Creating IAM Role "${ROLE_NAME}"...`);
            await iam.send(new CreateRoleCommand({
                RoleName: ROLE_NAME,
                AssumeRolePolicyDocument: LAMBDA_TRUST_POLICY,
                Description: 'Role for Remotion Lambda rendering functions',
            }));
            console.log(`   ✅ IAM Role created.`);
        } else {
            throw err;
        }
    }

    // 2. Attach inline policy
    try {
        await iam.send(new GetRolePolicyCommand({
            RoleName: ROLE_NAME,
            PolicyName: INLINE_POLICY_NAME,
        }));
        console.log(`   ✅ Inline policy "${INLINE_POLICY_NAME}" already attached.`);
    } catch (err: any) {
        if (err.name === 'NoSuchEntityException') {
            console.log(`   ⏳ Fetching Remotion role policy from CLI...`);
            const policyDoc = getRemotionRolePolicy();
            await iam.send(new PutRolePolicyCommand({
                RoleName: ROLE_NAME,
                PolicyName: INLINE_POLICY_NAME,
                PolicyDocument: policyDoc,
            }));
            console.log(`   ✅ Inline policy attached.`);
        } else {
            throw err;
        }
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ensures S3 Bucket has a 15-day lifecycle expiration rule for renders/
 */
async function ensureBucketLifecycle(bucketName: string): Promise<void> {
    const s3 = new S3Client({
        region: REGION,
        credentials: {
            accessKeyId: process.env.REMOTION_AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.REMOTION_AWS_SECRET_ACCESS_KEY!,
        },
    });

    try {
        await s3.send(new PutBucketLifecycleConfigurationCommand({
            Bucket: bucketName,
            LifecycleConfiguration: {
                Rules: [
                    {
                        ID: "ExpireOldRenders15Days",
                        Filter: { Prefix: "renders/" },
                        Status: "Enabled",
                        Expiration: { Days: 15 }
                    }
                ]
            }
        }));
        console.log(`   ✅ S3 Lifecycle Rule attached: 15-day expiration for renders/`);
    } catch (err: any) {
        console.error(`   ⚠️  Failed to attach S3 Lifecycle Rule: ${err.message}`);
    }
}

/**
 * Deploys the Lambda function with retry logic for IAM propagation delays.
 */
async function deployWithRetry(maxRetries = 3, delayMs = 15000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { functionName, alreadyExisted } = await deployFunction({
                region: REGION,
                timeoutInSeconds: TIMEOUT,
                memorySizeInMb: MEMORY_SIZE,
                diskSizeInMb: DISK_SIZE,
                createCloudWatchLogGroup: true,
            });
            const status = alreadyExisted ? '(updated)' : '(newly created)';
            return { functionName, status };
        } catch (err: any) {
            const isRoleError =
                err.name === 'InvalidParameterValueException' &&
                err.message?.includes('cannot be assumed by Lambda');

            if (isRoleError && attempt < maxRetries) {
                console.log(`   ⚠️  IAM role not yet propagated (attempt ${attempt}/${maxRetries}).`);
                console.log(`   ⏳ Waiting ${delayMs / 1000}s for propagation...`);
                await sleep(delayMs);
            } else {
                throw err;
            }
        }
    }
    throw new Error('Failed to deploy function after all retries.');
}

// --- Main ---
const deploy = async () => {
    console.log('🚀 Starting Lambda Deployment...');
    console.log(`   Region: ${REGION}`);
    console.log(`   Memory: ${MEMORY_SIZE}MB | Timeout: ${TIMEOUT}s | Disk: ${DISK_SIZE}MB`);

    if (!process.env.REMOTION_AWS_ACCESS_KEY_ID || !process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
        console.error('❌ Missing AWS credentials in .env');
        process.exit(1);
    }

    // Step 1: IAM
    console.log('\n🔐 Step 1/4: Ensuring IAM Role & Policy...');
    await ensureRoleExists();
    console.log('   ⏳ Waiting 10s for IAM propagation...');
    await sleep(10000);

    // Step 2: S3
    console.log('\n📦 Step 2/4: Ensuring S3 bucket...');
    const { bucketName } = await getOrCreateBucket({ region: REGION });
    console.log(`   ✅ Bucket ready: ${bucketName}`);
    await ensureBucketLifecycle(bucketName);

    // Step 3: Site
    console.log('\n📤 Step 3/4: Deploying site bundle to S3...');
    const entryPoint = path.join(process.cwd(), 'src', 'engine', 'index.ts');
    const { serveUrl } = await deploySite({
        entryPoint,
        bucketName,
        region: REGION,
        siteName: 'crea-ads-engine',
    });
    console.log(`   ✅ Site deployed: ${serveUrl}`);

    // Step 4: Function
    console.log('\n⚡ Step 4/4: Deploying Lambda function...');
    const { functionName, status } = await deployWithRetry();
    console.log(`   ✅ Function deployed: ${functionName} ${status}`);

    // Summary
    console.log('\n📊 === DEPLOYMENT SUMMARY ===');
    console.log(`   Region:       ${REGION}`);
    console.log(`   Bucket:       ${bucketName}`);
    console.log(`   Serve URL:    ${serveUrl}`);
    console.log(`   Function:     ${functionName}`);
    console.log(`   Memory:       ${MEMORY_SIZE}MB`);
    console.log(`   Timeout:      ${TIMEOUT}s`);
    console.log('\n✨ Deployment complete!');
    console.log(`\n💡 To render remotely:`);
    console.log(`   npx remotion lambda render ${serveUrl} LuxuryPreview --function-name=${functionName}`);
};

deploy().catch((err) => {
    console.error('❌ Deployment failed:', err.message || err);
    process.exit(1);
});
