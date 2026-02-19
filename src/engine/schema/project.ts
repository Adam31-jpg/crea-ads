import { z } from 'zod';

/**
 * 1. Semantic Intent (Input from AI/LLM)
 * High-level creative direction that describes *what* we want, not *how* to do it.
 */
export const CreativeIntentSchema = z.object({
    visualStyle: z.enum(['luxury_minimal', 'high_energy_sport', 'organic_warmth', 'corporate_clean']),
    cameraMotion: z.enum(['orbit_center', 'pan_horizontal', 'static_hero', 'zoom_impact']),
    colorMood: z.enum(['sunset', 'midnight', 'studio_white', 'electric_neon', 'brand_consistent']),
    emphasis: z.enum(['product_detail', 'typography_heavy', 'balanced']),
    copyTone: z.enum(['punchy', 'elegant', 'urgent']),
});

export type CreativeIntent = z.infer<typeof CreativeIntentSchema>;

/**
 * 2. Technical Props (Output to Remotion)
 * Low-level, deterministic properties that control the React components.
 * This schema serves as the "Contract" for the Rendering Engine.
 */
export const RemotionPropsSchema = z.object({
    // --- Content Props ---
    headlineText: z.string().max(40, "Headline too long"),
    subheadlineText: z.string().optional(),
    productImageUrl: z.string().url(),
    backgroundImageUrl: z.string().url().optional(),

    // --- Color Harmony (The Logic Layer output) ---
    colors: z.object({
        primary: z.string().regex(/^#/, "Must be hex code"),
        secondary: z.string().regex(/^#/, "Must be hex code"),
        accent: z.string().regex(/^#/, "Must be hex code"),
        background: z.string().regex(/^#/, "Must be hex code"),
        textPrimary: z.string().regex(/^#/, "Must be hex code"),
    }),

    // --- Typography & Style ---
    fontFamily: z.enum(['Inter', 'Bodoni', 'Roboto', 'Outfit']),
    glassmorphism: z.object({
        enabled: z.boolean(),
        intensity: z.number().min(0).max(1), // 0 to 1
        blur: z.number().min(0).max(20), // px
    }),

    // --- Camera & Motion (Three.js / Remotion) ---
    camera: z.object({
        zoomStart: z.number(),
        zoomEnd: z.number(),
        orbitSpeed: z.number(), // rad/s
        panX: z.number(),
    }),

    // --- Social Safe Areas (Responsive Layout) ---
    layout: z.object({
        aspectRatio: z.enum(['1:1', '9:16', '16:9', '4:5']),
        safePadding: z.number(), // px
        contentScale: z.number(), // 0.8 to 1.2
    }),
});

export type RemotionProps = z.infer<typeof RemotionPropsSchema>;

/**
 * 3. Generation Request (API Input)
 * The full payload sent to start a job.
 * Includes explicit Overrides that bypass the AI/Design Adapter.
 */
export const GenerationRequestSchema = z.object({
    batchId: z.string().uuid(),
    productData: z.object({
        name: z.string(),
        description: z.string(),
        imageUrl: z.string().url(),
    }),
    // Manual overrides that take precedence over AI logic
    overrides: RemotionPropsSchema.partial().optional(),
});

export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;
