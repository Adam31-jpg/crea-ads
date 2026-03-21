/**
 * Centralized Spark pricing for all Lumina actions.
 * Modify costs HERE — they propagate everywhere.
 *
 * RULES:
 * - Every action that costs Sparks MUST import from this file
 * - Never hardcode Spark costs in API routes or components
 * - Frontend imports this to display costs on buttons
 */

export const SPARK_PRICING = {
    // ─── Image Generation ─────────────────────────────────────
    GENERATE_1K: 1,
    GENERATE_2K: 2,
    GENERATE_4K: 3,

    // ─── Video Generation (future) ────────────────────────────
    GENERATE_VIDEO: 3,

    // ─── Analysis Actions ─────────────────────────────────────
    ANALYZE_STORE: 0,       // Free — funnel entry
    FIND_COMPETITORS: 0,    // Free
    EXTRACT_CREATIVES: 0,   // Free — first extraction
    EXPAND_ANALYSIS: 5,     // Re-extraction with new creatives
    SHOW_MORE_RESULTS: 3,   // Unlock next 10 blueprints

    // ─── Regeneration ─────────────────────────────────────────
    REGENERATE_IMAGE: 1,    // Generate a different variant

    // ─── Account ──────────────────────────────────────────────
    SIGNUP_CREDITS: 5,

    // ─── Display Limits ───────────────────────────────────────
    INITIAL_VISIBLE_BLUEPRINTS: 10,  // Show 10 blueprints initially
    SHOW_MORE_BATCH_SIZE: 10,        // Each "show more" unlocks 10 more
} as const;

export type SparkAction = keyof typeof SPARK_PRICING;

export function getGenerationCost(resolution: string): number {
    switch (resolution) {
        case "2K": return SPARK_PRICING.GENERATE_2K;
        case "4K": return SPARK_PRICING.GENERATE_4K;
        default:   return SPARK_PRICING.GENERATE_1K;
    }
}
