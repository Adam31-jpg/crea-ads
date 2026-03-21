import { SPARK_PRICING } from "./spark-pricing";

export const GENERATION_CONFIG = {
    COST_PER_ASSET: 1,
    TOTAL_MEDIA_PER_BATCH: 3,  // Legacy compat
    IMAGE_COUNT: 3,
    VIDEO_COUNT: 0,
    IMAGE_SPARK_COST: SPARK_PRICING.GENERATE_1K,
    IMAGE_2K_SPARK_COST: SPARK_PRICING.GENERATE_2K,
    IMAGE_4K_SPARK_COST: SPARK_PRICING.GENERATE_4K,
    VIDEO_SPARK_COST: SPARK_PRICING.GENERATE_VIDEO,
    STRATEGY_SPARK_COST: 0,
    ANALYSIS_SPARK_COST: 0,    // Steps 1-3 are free
    SIGNUP_CREDITS: SPARK_PRICING.SIGNUP_CREDITS,
    AI_MODELS: {
        STRATEGY: "gemini-2.5-flash",
        IMAGE_GEN: "fal-ai/nano-banana-2/edit",
        IMAGE_GEN_LEGACY: "fal-ai/flux/schnell",
        BACKGROUND: "fal-ai/flux/schnell", // Legacy alias — kept for dormant render routes
    },
    FAL_DEFAULTS: {
        resolution: "1K" as const,
        output_format: "png" as const,
        safety_tolerance: "4" as const,
        limit_generations: true,
    },
    STORAGE_BUCKETS: {
        PRODUCTS: "product-assets",
        BACKGROUNDS: "background-assets",
    },
    FALLBACK_THEME: "linear-gradient(to bottom, #0A0A0F, #1a1a2e)",
} as const;
