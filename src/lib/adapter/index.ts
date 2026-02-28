import { CreativeIntent, RemotionProps, RemotionPropsSchema } from '@/engine/schema/project';

/**
 * DESIGN ADAPTER
 * The core logic layer that translates "Semantic Keys" (e.g. 'luxury_minimal')
 * into "Technical Tokens" (e.g. specific fonts, speeds, colors).
 */

const STYLE_MAPPINGS: Record<string, Partial<RemotionProps>> = {
    luxury_minimal: {
        fontFamily: 'Bodoni',
        glassmorphism: { enabled: true, intensity: 0.2, blur: 10 },
        camera: { zoomStart: 1.2, zoomEnd: 1.0, orbitSpeed: 0.05, panX: 0 },
    },
    high_energy_sport: {
        fontFamily: 'Outfit',
        glassmorphism: { enabled: false, intensity: 0, blur: 0 },
        camera: { zoomStart: 1.0, zoomEnd: 1.4, orbitSpeed: 0.2, panX: 0.5 },
    },
    // Defaults for others...
};

const COLOR_MOODS: Record<string, RemotionProps['colors']> = {
    midnight: {
        primary: '#1a1a2e',
        secondary: '#16213e',
        accent: '#e94560',
        background: '#0f3460',
        textPrimary: '#ffffff',
    },
    studio_white: {
        primary: '#ffffff',
        secondary: '#f0f0f0',
        accent: '#000000',
        background: '#ffffff',
        textPrimary: '#1a1a1a',
    },
    // ... more moods
};

/**
 * resolves a high-level creative intent into concrete technical props.
 * Applies overrides last to ensure user control.
 */
export function resolveDesign(
    intent: CreativeIntent,
    productData: { imageUrl: string, name: string },
    overrides?: Partial<RemotionProps>
): RemotionProps {

    // 1. Resolve Base Style from Intent
    const baseStyle = STYLE_MAPPINGS[intent.visualStyle] || STYLE_MAPPINGS['luxury_minimal'];

    // 2. Resolve Colors from Intent (or default)
    const baseColors = COLOR_MOODS[intent.colorMood] || COLOR_MOODS['studio_white'];

    // 3. Construct the Default Technical Props
    const defaultProps: RemotionProps = {
        headlineText: productData.name.substring(0, 40), // Truncate to safe length
        subheadlineText: '',
        productImageUrl: productData.imageUrl,
        backgroundImageUrl: '', // To be filled by Fal.ai logic later

        colors: baseColors,
        fontFamily: baseStyle.fontFamily || 'Inter',
        glassmorphism: baseStyle.glassmorphism || { enabled: false, intensity: 0, blur: 0 },

        camera: baseStyle.camera || { zoomStart: 1, zoomEnd: 1, orbitSpeed: 0.1, panX: 0 },

        enableMotionBlur: false,

        layout: {
            layoutType: 'converter',
            aspectRatio: '1:1', // Default, can be overridden
            safePadding: 100,
            contentScale: 1.0
        },
        elements: [],
        hideHeroObject: false,
        compositionIntent: 'direct_response',
    };

    // 4. Merge Overrides (The "Override Priority" Logic)
    // We perform a deep merge concept, but for now object spread works for top-level.
    // For nested objects (like camera, colors), we need to be careful.
    // Using a simple spread for this MVP level, but a deep merge util is recommended for prod.

    const mergedProps: RemotionProps = {
        ...defaultProps,
        ...overrides,
        // Explicitly merge nested objects if overrides exist for them
        colors: { ...defaultProps.colors, ...overrides?.colors },
        glassmorphism: { ...defaultProps.glassmorphism, ...overrides?.glassmorphism },
        camera: { ...defaultProps.camera, ...overrides?.camera },
        layout: { ...defaultProps.layout, ...overrides?.layout },
    };

    // 5. Final Validation
    // Ensure the result actually matches the schema (safety net)
    return RemotionPropsSchema.parse(mergedProps);
}
