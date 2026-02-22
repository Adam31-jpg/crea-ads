export const GENERATION_CONFIG = {
    TOTAL_MEDIA_PER_BATCH: 2,
    IMAGE_COUNT: 1,
    VIDEO_COUNT: 1,
    IMAGE_SPARK_COST: 1,
    VIDEO_SPARK_COST: 1,
    STRATEGY_SPARK_COST: 0 // Free strategy generation to match exactly 1 Spark per asset
} as const;
