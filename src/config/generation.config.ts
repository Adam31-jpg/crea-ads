export const GENERATION_CONFIG = {
    COST_PER_ASSET: 1, // 1 Spark = 1 Media
    TOTAL_MEDIA_PER_BATCH: 5,
    IMAGE_COUNT: 4,
    VIDEO_COUNT: 1,
    IMAGE_SPARK_COST: 1,
    VIDEO_SPARK_COST: 1,
    STRATEGY_SPARK_COST: 0, // Free strategy generation to match exactly 1 Spark per asset
    AI_MODELS: {
        STRATEGY: "gemini-3-pro-preview",
        BACKGROUND: "fal-ai/flux/schnell",
    },
    STORAGE_BUCKETS: {
        PRODUCTS: "product-assets",
        BACKGROUNDS: "background-assets",
    },
    FALLBACK_THEME: "linear-gradient(to bottom, #0A0A0F, #1a1a2e)"
} as const;
