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
    layoutType: z.enum(['converter', 'minimalist']).default('converter'),
});

export type CreativeIntent = z.infer<typeof CreativeIntentSchema>;

/**
 * 2. Technical Props (Output to Remotion)
 * Low-level, deterministic properties that control the React components.
 * This schema serves as the "Contract" for the Rendering Engine.
 */
export const UIElementSchema = z.object({
    id: z.string(),
    type: z.enum(['headline', 'subheadline', 'badge', 'logo', 'cta']),
    x: z.number(), // Percentage 0-100
    y: z.number(), // Percentage 0-100
    width: z.number().optional(), // Percentage 0-100
    height: z.number().optional(), // Percentage 0-100
    content: z.string().optional(),
    align: z.enum(['left', 'center', 'right']).default('center'),
});

export const RemotionPropsSchema = z.object({
    // --- Content Props ---
    headlineText: z.string().max(100, "Headline too long (max 100)"),
    subheadlineText: z.string().optional(),
    productImageUrl: z.string().url(),
    backgroundImageUrl: z.string().url().optional(),
    logoUrl: z.string().url().optional().nullable(),
    logoPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional().nullable(),

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

    // --- Audio Props ---
    audio: z.object({
        audioUrl: z.string().url(),
        volume: z.number().min(0).max(1).default(0.5),
        bpm: z.number().min(40).max(200).default(120),
        startFrom: z.number().min(0).default(0), // Start from X seconds
    }).optional(),

    // --- Transition Props ---
    transition: z.object({
        style: z.enum(['none', 'wipe', 'blur', 'fade']).default('none'),
        duration: z.number().min(0).max(2).default(0.5), // Seconds
    }).optional(),

    // --- Performance / Quality ---
    enableMotionBlur: z.boolean().default(false),

    // --- Social Safe Areas (Responsive Layout) ---
    layout: z.object({
        layoutType: z.enum(['converter', 'minimalist']).default('converter'),
        aspectRatio: z.enum(['1:1', '9:16', '16:9', '4:5']),
        safePadding: z.number(), // px
        contentScale: z.number(), // 0.8 to 1.2
    }),
    elements: z.array(UIElementSchema).default([]),
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
