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
    /** Visual legibility treatment applied to text against the generated background. */
    text_treatment: z.enum(['none', 'shadow', 'glass', 'outline', 'hero_block']).default('shadow'),
    /** Per-element font weight override from the Director's Brain. */
    font_weight: z.enum(['thin', 'regular', 'bold', 'black']).optional(),
});

// ─── Layout Config — Spatial Design System ───────────────────────────────────
// Gemini outputs one of these per concept. It defines both WHERE the product sits
// in the background scene (→ negative space instruction injected into fal prompt)
// and WHERE every Remotion overlay element is positioned (→ inputProps).
// Stored verbatim in jobs.metadata for Lumina Studio readiness.

export const SocialProofSchema = z.object({
    x: z.number().min(0).max(100),   // % from left
    y: z.number().min(0).max(100),   // % from top
    scale: z.number().min(0.5).max(2),    // relative to default size
});

export const ArrowSchema = z.object({
    startPos: z.tuple([z.number(), z.number()]),  // [x%, y%]
    endPos: z.tuple([z.number(), z.number()]),  // [x%, y%]
    curvature: z.number().min(-1).max(1),           // -1 = concave, 0 = straight, 1 = convex
});

export const TrustBarSchema = z.object({
    y_position: z.number().min(0).max(100),  // % from top
    opacity: z.number().min(0).max(1),
    /** Optional trust label override. Defaults to "AS SEEN ON" strip if omitted. */
    label: z.string().optional(),
});

// ─── Component Registry Schemas (Lego Architecture) ──────────────────────────

export const PointerBenefitSchema = z.object({
    component: z.literal('PointerBenefit'),
    props: z.object({
        label: z.string(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        dotColor: z.string().regex(/^#/, "Must be hex code").optional(),
    }),
});

export const FeatureSwitchSchema = z.object({
    component: z.literal('FeatureSwitch'),
    props: z.object({
        label: z.string(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        isActive: z.boolean().default(true),
        activeColor: z.string().regex(/^#/, "Must be hex code").optional(),
    }),
});

export const BackgroundPatternSchema = z.object({
    component: z.literal('BackgroundPattern'),
    props: z.object({
        text: z.string(),
        opacity: z.number().min(0).max(1).default(0.1),
        color: z.string().regex(/^#/, "Must be hex code").optional(),
        rotation: z.number().default(-15),
    }),
});

export const SocialBadgeSchema = z.object({
    component: z.literal('SocialBadge'),
    props: z.object({
        label: z.string(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        starColor: z.string().regex(/^#/, "Must be hex code").optional(),
    }),
});

export const BenefitGridSchema = z.object({
    component: z.literal('BenefitGrid'),
    props: z.object({
        benefits: z.array(z.string()).max(4),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        accentColor: z.string().regex(/^#/, "Must be hex code").optional(),
    }),
});

export const ComparisonSliderSchema = z.object({
    component: z.literal('ComparisonSlider'),
    props: z.object({
        beforeText: z.string().optional(),
        afterText: z.string().optional(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
    }),
});

export const CleanIngredientSchema = z.object({
    component: z.literal('CleanIngredient'),
    props: z.object({
        ingredient: z.string(),
        subtext: z.string().optional(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        accentColor: z.string().regex(/^#/, "Must be hex code").optional(),
    }),
});

export const ShapeOverlaySchema = z.object({
    component: z.literal('ShapeOverlay'),
    props: z.object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        color: z.string().regex(/^#/, "Must be hex code").optional(),
        opacity: z.number().min(0).max(1).optional(),
    }),
});

export const ScrollingRibbonSchema = z.object({
    component: z.literal('ScrollingRibbon'),
    props: z.object({
        text: z.string(),
        position: z.enum(['top', 'bottom']).default('bottom'),
        color: z.string().regex(/^#/, "Must be hex code").optional(),
        bgColor: z.string().regex(/^#/, "Must be hex code").optional(),
    }),
});

export const OutlineTextSchema = z.object({
    component: z.literal('OutlineText'),
    props: z.object({
        text: z.string(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        fontSize: z.number().min(10).max(500).optional(),
        color: z.string().regex(/^#/, "Must be hex code").optional(),
    }),
});

export const BrandHeaderSchema = z.object({
    component: z.literal('BrandHeader'),
    props: z.object({
        brandName: z.string(),
        x: z.number().min(0).max(100).optional(),
        y: z.number().min(0).max(100).optional(),
    }),
});

export const FeatureCardSchema = z.object({
    component: z.literal('FeatureCard'),
    props: z.object({
        features: z.array(z.string()).min(1).max(5),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        activeColor: z.string().regex(/^#/, "Must be hex code").optional(),
    }),
});

export const AnyComponentSchema = z.discriminatedUnion('component', [
    PointerBenefitSchema,
    FeatureSwitchSchema,
    BackgroundPatternSchema,
    SocialBadgeSchema,
    BenefitGridSchema,
    ComparisonSliderSchema,
    CleanIngredientSchema,
    ShapeOverlaySchema,
    ScrollingRibbonSchema,
    OutlineTextSchema,
    BrandHeaderSchema,
    FeatureCardSchema,
]);


export type AnyComponentConfig = z.infer<typeof AnyComponentSchema>;

export const LayoutConfigSchema = z.object({
    /**
     * 1-sentence description of the spatial composition.
     * e.g. "Product anchored bottom-right, negative space reserved top-left for typography."
     */
    spatial_strategy: z.string(),

    /**
     * The canvas zone where the image generation model MUST leave clean, empty
     * space for Remotion text overlays. This is injected verbatim into the fal.ai prompt:
     * "with a minimalist, out-of-focus, empty area in the [zone] for typography".
     */
    negative_space_zone: z.enum([
        'top-left', 'top-right', 'bottom-left', 'bottom-right',
        'top', 'bottom', 'left', 'right', 'center',
    ]),

    /** Primary headline layout — MUST mirror the matching entry in elements[]. */
    headline: z.object({
        text: z.string(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        width: z.number().min(10).max(90),
        fontSize: z.number().min(20).max(120),
        textAlign: z.enum(['left', 'center', 'right']),
        color: z.string(),                   // hex color
    }),

    /** ★★★★★ social proof badges. Optional. */
    social_proof: SocialProofSchema.optional(),

    /** Directional SVG arrow connecting startPos → endPos. Optional. */
    arrow: ArrowSchema.optional(),

    /** Horizontal trust logo/text bar. Optional. */
    trust_bar: TrustBarSchema.optional(),
});

export type LayoutConfig = z.infer<typeof LayoutConfigSchema>;
export type SocialProof = z.infer<typeof SocialProofSchema>;
export type ArrowConfig = z.infer<typeof ArrowSchema>;
export type TrustBarConfig = z.infer<typeof TrustBarSchema>;

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

    // --- Dynamic Component Layout (Lego Architecture) ---
    component_layout: z.array(AnyComponentSchema).optional(),

    /** Dominant light direction inferred by Gemini — aligns 3D light with the painted scene. */
    sceneLightDirection: z.string().optional(),

    /** Surface material the product rests on — drives shadow opacity and tint. */
    contactSurface: z.string().optional(),

    /**
     * Controls text density for the composition.
     * direct_response = full HL+SHL+CTA (conversion focus)
     * editorial        = HL+SHL only (visual-first)
     * cinematic        = headline only, oversized (maximum visual impact)
     */
    compositionIntent: z.enum(['direct_response', 'editorial', 'cinematic']).default('direct_response'),

    /** 3D lighting preset that matches the background scene mood. */
    lightingIntent: z.string().optional(),

    /**
     * Bundle-aware product URL array (up to 3).
     * When present, HeroObject renders a group-shot layout.
     * Falls back to [productImageUrl] when absent.
     */
    productImageUrls: z.array(z.string().url()).min(1).max(3).optional(),

    /**
     * Spatial Design System from Gemini's Director's Brain.
     * Encodes product placement, negative space zone, and positions of all
     * Remotion overlay elements (headline, social proof, arrow, trust bar).
     * Stored verbatim in jobs.metadata for Lumina Studio readiness.
     */
    layout_config: LayoutConfigSchema.optional(),

    /**
     * When true, the Three.js HeroObject layer is suppressed entirely.
     * Set by the render API for still images where the product is already
     * baked into the background by BRIA — rendering HeroObject on top
     * would cause a "double layer" sticker artifact.
     * Videos always receive false (default) to keep the 3D pipeline alive.
     */
    hideHeroObject: z.boolean().default(false),
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
