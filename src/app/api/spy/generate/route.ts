import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fal } from "@fal-ai/client";
import { uploadUrlToS3 } from "@/lib/s3";
import { broadcast } from "@/lib/sse";
import { getGenerationCost } from "@/config/spark-pricing";

fal.config({ credentials: process.env.FAL_KEY });

const LANG_MAP: Record<string, string> = {
    fr: "French",
    en: "English",
    de: "German",
    es: "Spanish",
    it: "Italian",
};

// ── CAS 1: Both product image + competitor ad image ───────────────────────────
// image_urls[0] = user's product  →  "show this product prominently"
// image_urls[1] = competitor ad   →  "replicate this style/layout"
async function generateWithBothImages(
    prompt: string,
    productImageUrl: string,
    competitorAdImageUrl: string,
    aspectRatio: string,
    resolution: string,
    maxRetries = 3,
): Promise<{ url: string } | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
                input: {
                    prompt,
                    image_urls: [productImageUrl, competitorAdImageUrl],
                    aspect_ratio: aspectRatio as "9:16" | "1:1" | "16:9" | "4:5",
                    resolution: resolution as "1K" | "2K" | "4K",
                    output_format: "png",
                    safety_tolerance: "4",
                    limit_generations: true,
                },
            });
            const images = (result.data as { images?: Array<{ url: string }> })?.images;
            if (images && images[0]?.url) return { url: images[0].url };
        } catch (err) {
            console.error(`[spy/generate] BOTH_IMAGES attempt ${attempt} failed:`, err);
            if (attempt < maxRetries) await new Promise((r) => setTimeout(r, attempt * 1000));
        }
    }
    return null;
}

// ── CAS 2: Product image only ─────────────────────────────────────────────────
async function generateWithProductOnly(
    prompt: string,
    productImageUrl: string,
    aspectRatio: string,
    resolution: string,
    maxRetries = 3,
): Promise<{ url: string } | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
                input: {
                    prompt,
                    image_urls: [productImageUrl],
                    aspect_ratio: aspectRatio as "9:16" | "1:1" | "16:9" | "4:5",
                    resolution: resolution as "1K" | "2K" | "4K",
                    output_format: "png",
                    safety_tolerance: "4",
                    limit_generations: true,
                },
            });
            const images = (result.data as { images?: Array<{ url: string }> })?.images;
            if (images && images[0]?.url) return { url: images[0].url };
        } catch (err) {
            console.error(`[spy/generate] PRODUCT_ONLY attempt ${attempt} failed:`, err);
            if (attempt < maxRetries) await new Promise((r) => setTimeout(r, attempt * 1000));
        }
    }
    return null;
}

// ── CAS 3: Text-to-image (no product image) ───────────────────────────────────
async function generateTextToImage(
    prompt: string,
    aspectRatio: string,
    resolution: string,
    maxRetries = 3,
): Promise<{ url: string } | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fal.subscribe("fal-ai/nano-banana-2", {
                input: {
                    prompt,
                    aspect_ratio: aspectRatio as "9:16" | "1:1" | "16:9" | "4:5",
                    resolution: resolution as "1K" | "2K" | "4K",
                    output_format: "png",
                    safety_tolerance: "4",
                    limit_generations: true,
                },
            });
            const images = (result.data as { images?: Array<{ url: string }> })?.images;
            if (images && images[0]?.url) return { url: images[0].url };
        } catch (err) {
            console.error(`[spy/generate] TEXT_ONLY attempt ${attempt} failed:`, err);
            if (attempt < maxRetries) await new Promise((r) => setTimeout(r, attempt * 1000));
        }
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;

        const body = await req.json();
        const {
            blueprintId,
            productImageUrl: bodyProductImageUrl,
            resolution = "1K",
            language = "fr",
            aspectRatio: bodyAspectRatio,
        } = body as {
            blueprintId: string;
            productImageUrl?: string | null;
            resolution?: "1K" | "2K" | "4K";
            language?: string;
            aspectRatio?: string;
        };

        if (!blueprintId) {
            return NextResponse.json({ error: "blueprintId is required" }, { status: 400 });
        }

        if (!process.env.FAL_KEY) {
            return NextResponse.json({ error: "configuration_error" }, { status: 500 });
        }

        const blueprint = await prisma.creativeBlueprint.findUnique({
            where: { id: blueprintId },
        });

        if (!blueprint) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        // ── Load store & competitor context ───────────────────────────────────
        const storeAnalysis = await prisma.storeAnalysis.findFirst({
            where: { id: blueprint.storeAnalysisId },
            select: {
                storeName: true,
                productCategory: true,
                niche: true,
                productImageUrl: true,
            },
        });

        const competitor = blueprint.competitorAnalysisId
            ? await prisma.competitorAnalysis.findUnique({
                  where: { id: blueprint.competitorAnalysisId },
                  select: { competitorName: true },
              })
            : null;

        // ── Resolve images ────────────────────────────────────────────────────
        const productImageUrl =
            bodyProductImageUrl ??
            blueprint.customProductImageUrl ??
            storeAnalysis?.productImageUrl ??
            null;

        const competitorAdImageUrl = blueprint.sourceImageUrl ?? null;

        // ── Resolve aspect ratio (body overrides blueprint) ───────────────────
        const aspectRatio = bodyAspectRatio ?? blueprint.aspectRatio ?? "1:1";

        // ── Resolve language label ────────────────────────────────────────────
        const langLabel = LANG_MAP[language] ?? "French";
        const brandName = storeAnalysis?.storeName ?? "the brand";

        // ── Determine generation case ─────────────────────────────────────────
        const hasBothImages = !!(productImageUrl && competitorAdImageUrl);
        const hasProductOnly = !!(productImageUrl && !competitorAdImageUrl);
        const generationCase = hasBothImages
            ? "BOTH_IMAGES"
            : hasProductOnly
              ? "PRODUCT_ONLY"
              : "TEXT_ONLY";

        console.log(`[spy/generate] ──────────────────────────────────────────────────`);
        console.log(`[spy/generate] Blueprint : "${blueprint.creativeName}" (${blueprint.id})`);
        console.log(`[spy/generate] Brand     : ${brandName}`);
        console.log(`[spy/generate] Competitor: ${competitor?.competitorName ?? "none"}`);
        console.log(`[spy/generate] Case      : ${generationCase}`);
        console.log(`[spy/generate] AspectRatio: ${aspectRatio} | Resolution: ${resolution}`);
        console.log(`[spy/generate] Language  : ${language} → ${langLabel}`);
        console.log(`[spy/generate] ProductImg: ${productImageUrl ? "✓ " + productImageUrl.slice(0, 60) + "…" : "✗ none"}`);
        console.log(`[spy/generate] CompAdImg : ${competitorAdImageUrl ? "✓ " + competitorAdImageUrl.slice(0, 60) + "…" : "✗ none"}`);

        // ── Build final prompt per case ───────────────────────────────────────
        let finalPrompt: string;

        if (generationCase === "BOTH_IMAGES") {
            // Replace competitor name in the reproduction prompt
            let basePrompt = blueprint.reproductionPrompt;
            if (competitor?.competitorName && brandName) {
                const escapedName = competitor.competitorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                basePrompt = basePrompt.replace(new RegExp(escapedName, "gi"), brandName);
            }

            finalPrompt =
                `Create a professional advertising image for ${brandName}. ` +
                `Use the FIRST image as the product to feature — show this exact product prominently in the scene. ` +
                `Use the SECOND image as a STYLE REFERENCE ONLY — replicate its layout, composition, color scheme, background, lighting, text placement, and overall aesthetic exactly. ` +
                `Do NOT show the product from the second image; it is purely a style guide. ` +
                `Adapt all text, headlines, CTAs, and copy for ${brandName}` +
                (storeAnalysis?.productCategory ? ` (${storeAnalysis.productCategory})` : "") +
                `. ` +
                `CRITICAL: All text in this creative MUST be written in ${langLabel}. Generate native-level marketing copy. ` +
                `Layout reference: ${basePrompt}`;

            console.log(`[spy/generate] Prompt (BOTH_IMAGES, first 200 chars): ${finalPrompt.slice(0, 200)}…`);
        } else if (generationCase === "PRODUCT_ONLY") {
            let basePrompt = blueprint.reproductionPrompt;
            if (competitor?.competitorName && brandName) {
                const escapedName = competitor.competitorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                basePrompt = basePrompt.replace(new RegExp(escapedName, "gi"), brandName);
            }

            // Append brand context
            basePrompt +=
                `. Brand: ${brandName}` +
                (storeAnalysis?.productCategory ? `, ${storeAnalysis.productCategory}` : "") +
                `. Ensure all text overlays, packaging, and product references are for ${brandName}.`;

            finalPrompt =
                `BACKGROUND AND LAYOUT ONLY — do NOT render any product, packaging, bottle, tube, earplugs, strip, pill, capsule, or branded item in the scene. Only render the background, lighting, text overlays, and compositional elements. The product will be composited from the provided image. ` +
                basePrompt +
                ` CRITICAL: All text in this creative MUST be written in ${langLabel}. Generate native-level marketing copy.`;

            console.log(`[spy/generate] Prompt (PRODUCT_ONLY, first 200 chars): ${finalPrompt.slice(0, 200)}…`);
        } else {
            // TEXT_ONLY
            let basePrompt = blueprint.reproductionPrompt;
            if (competitor?.competitorName && brandName) {
                const escapedName = competitor.competitorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                basePrompt = basePrompt.replace(new RegExp(escapedName, "gi"), brandName);
            }

            basePrompt +=
                `. Brand: ${brandName}` +
                (storeAnalysis?.productCategory ? `, ${storeAnalysis.productCategory}` : "") +
                `. Ensure all text overlays, packaging, and product references are for ${brandName}.`;

            finalPrompt =
                basePrompt +
                ` CRITICAL: All text in this creative MUST be written in ${langLabel}. Generate native-level marketing copy.`;

            console.log(`[spy/generate] Prompt (TEXT_ONLY, first 200 chars): ${finalPrompt.slice(0, 200)}…`);
        }

        const sparkCost = getGenerationCost(resolution);
        console.log(`[spy/generate] Spark cost: ${sparkCost} | Resolution: ${resolution}`);

        // ── Spark check ───────────────────────────────────────────────────────
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.credits < sparkCost) {
            return NextResponse.json({ error: "insufficient_sparks" }, { status: 402 });
        }

        // Debit before generation
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: sparkCost } },
        });

        // ── Batch / Job scaffolding ───────────────────────────────────────────
        let batch = await prisma.batch.findFirst({
            where: { userId, status: "spy_active" },
            orderBy: { createdAt: "desc" },
        });

        if (!batch) {
            batch = await prisma.batch.create({
                data: { userId, status: "spy_active", metadata: { source: "spy" } },
            });
        }

        const job = await prisma.job.create({
            data: {
                batchId: batch.id,
                userId,
                status: "rendering",
                type: "image",
                blueprintId,
                source: "spy",
                metadata: { resolution, blueprintId, productImageUrl, generationCase },
            },
        });

        await prisma.creativeBlueprint.update({
            where: { id: blueprintId },
            data: { status: "generating" },
        });

        broadcast(userId, { type: "job_update", jobId: job.id, status: "rendering" });

        console.log(`[spy/generate] Job created: ${job.id} | Calling Fal.ai (${generationCase})…`);

        // ── Generate via Fal.ai ───────────────────────────────────────────────
        let falResult: { url: string } | null = null;

        if (generationCase === "BOTH_IMAGES") {
            falResult = await generateWithBothImages(
                finalPrompt,
                productImageUrl!,
                competitorAdImageUrl!,
                aspectRatio,
                resolution,
            );
        } else if (generationCase === "PRODUCT_ONLY") {
            falResult = await generateWithProductOnly(
                finalPrompt,
                productImageUrl!,
                aspectRatio,
                resolution,
            );
        } else {
            falResult = await generateTextToImage(finalPrompt, aspectRatio, resolution);
        }

        if (!falResult) {
            // Refund Sparks
            await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: sparkCost } },
            });
            await prisma.job.update({
                where: { id: job.id },
                data: { status: "failed", error_message: "generation_failed" },
            });
            await prisma.creativeBlueprint.update({
                where: { id: blueprintId },
                data: { status: "failed" },
            });
            broadcast(userId, { type: "job_update", jobId: job.id, status: "failed", error: "generation_failed" });
            console.error(`[spy/generate] Fal.ai returned no result for job ${job.id} (${generationCase})`);
            return NextResponse.json({ error: "generation_failed", jobId: job.id }, { status: 500 });
        }

        console.log(`[spy/generate] Fal.ai success — uploading to S3…`);

        // ── Upload to S3 ──────────────────────────────────────────────────────
        let resultUrl = await uploadUrlToS3(falResult.url, "nanob2", "image/png");

        if (!resultUrl) {
            for (let i = 0; i < 2; i++) {
                resultUrl = await uploadUrlToS3(falResult.url, "nanob2", "image/png");
                if (resultUrl) break;
            }
            if (!resultUrl) {
                resultUrl = falResult.url;
                broadcast(userId, {
                    type: "job_update",
                    jobId: job.id,
                    status: "done",
                    result_url: resultUrl,
                    warning: "upload_failed",
                });
            }
        }

        await prisma.job.update({ where: { id: job.id }, data: { status: "done", result_url: resultUrl } });
        await prisma.creativeBlueprint.update({ where: { id: blueprintId }, data: { status: "done" } });

        broadcast(userId, { type: "job_update", jobId: job.id, status: "done", result_url: resultUrl });

        const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
        if (updatedUser) broadcast(userId, { type: "credits_update", credits: updatedUser.credits });

        console.log(`[spy/generate] Done — job=${job.id} result=${resultUrl?.slice(0, 60)}…`);
        console.log(`[spy/generate] ──────────────────────────────────────────────────`);

        return NextResponse.json({ jobId: job.id, result_url: resultUrl });
    } catch (err) {
        console.error("[spy/generate]", err);
        return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
}
