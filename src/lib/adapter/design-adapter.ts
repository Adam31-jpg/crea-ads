import { z } from 'zod';
import {
    CreativeIntent,
    RemotionProps,
    RemotionPropsSchema,
    CreativeIntentSchema
} from '../../engine/schema/project';

// --- Theme Definitions ---

type ThemeMap = {
    [key in CreativeIntent['visualStyle']]: Partial<RemotionProps>
};

const THEMES: ThemeMap = {
    luxury_minimal: {
        fontFamily: 'Bodoni',
        glassmorphism: { enabled: true, intensity: 0.2, blur: 5 },
        camera: { zoomStart: 1, zoomEnd: 1.05, orbitSpeed: 0.05, panX: 0 },
        colors: {
            primary: '#D4AF37', // Gold
            secondary: '#111111', // Black
            accent: '#F5F5F5', // Off-white
            background: '#050505', // Deep dark
            textPrimary: '#FFFFFF'
        }
    },
    high_energy_sport: {
        fontFamily: 'Outfit', // Modern, geometric
        glassmorphism: { enabled: false, intensity: 0, blur: 0 },
        camera: { zoomStart: 1.1, zoomEnd: 1.0, orbitSpeed: 0.3, panX: 5 },
        colors: {
            primary: '#FF4500', // OrangeRed
            secondary: '#000000',
            accent: '#FFFF00', // Yellow
            background: '#1a1a1a',
            textPrimary: '#FFFFFF'
        }
    },
    corporate_clean: {
        fontFamily: 'Inter',
        glassmorphism: { enabled: true, intensity: 0.8, blur: 15 },
        camera: { zoomStart: 1, zoomEnd: 1, orbitSpeed: 0.02, panX: 0 },
        colors: {
            primary: '#0070f3', // Blue
            secondary: '#ffffff',
            accent: '#333333',
            background: '#f0f2f5',
            textPrimary: '#111111'
        }
    },
    organic_warmth: {
        fontFamily: 'Roboto',
        glassmorphism: { enabled: true, intensity: 0.3, blur: 10 },
        camera: { zoomStart: 1.05, zoomEnd: 1.1, orbitSpeed: 0.08, panX: 0 },
        colors: {
            primary: '#8B4513', // SaddleBrown
            secondary: '#F5DEB3', // Wheat
            accent: '#228B22', // ForestGreen
            background: '#FFF8DC', // Cornsilk
            textPrimary: '#3e2723'
        }
    }
};

// --- Aspect Ratio Logic ---

const getLayoutForAspectRatio = (aspectRatio: RemotionProps['layout']['aspectRatio']): RemotionProps['layout'] => {
    switch (aspectRatio) {
        case '9:16':
            return { aspectRatio: '9:16', safePadding: 140, contentScale: 0.85 }; // Smaller content to fit safe zones
        case '1:1':
            return { aspectRatio: '1:1', safePadding: 50, contentScale: 1.0 };
        case '16:9':
            return { aspectRatio: '16:9', safePadding: 80, contentScale: 1.1 }; // Widescreen can handle larger text
        case '4:5':
            return { aspectRatio: '4:5', safePadding: 60, contentScale: 0.95 };
        default:
            return { aspectRatio: '1:1', safePadding: 50, contentScale: 1.0 };
    }
};

// --- Main Adapter Function ---

export function resolveDesign(
    intent: CreativeIntent,
    overrides?: Partial<RemotionProps>
): RemotionProps {

    // 1. Base Theme
    const theme = THEMES[intent.visualStyle] || THEMES.luxury_minimal;

    // 2. Resolve Colors (can be influenced by colorMood, but for now strict theme map + overrides)
    // TODO: Implement advanced color harmony logic here if needed (FR8)

    // 3. Resolve Layout
    const targetAspectRatio = overrides?.layout?.aspectRatio || '1:1';
    const layout = getLayoutForAspectRatio(targetAspectRatio);

    // 4. Construct Preliminary Props (Theme + Defaults)
    const baseProps: RemotionProps = {
        headlineText: "Default Headline", // Should always be provided by caller, but safe fallback
        subheadlineText: "",
        productImageUrl: "", // Must be provided
        backgroundImageUrl: undefined,

        // Spread Theme
        colors: theme.colors!,
        fontFamily: theme.fontFamily!,
        glassmorphism: theme.glassmorphism!,
        camera: theme.camera!,

        // Defaults for optional features
        enableMotionBlur: false,

        // Spread Computed Layout
        layout: layout,
    };

    // 5. Apply Overrides (Deep Merge strategy might be better, but shallow for now is safer for exact control)
    const finalProps = {
        ...baseProps,
        ...overrides,
        // Ensure nested objects are merged correctly if partials are passed
        colors: { ...baseProps.colors, ...overrides?.colors },
        glassmorphism: { ...baseProps.glassmorphism, ...overrides?.glassmorphism },
        camera: { ...baseProps.camera, ...overrides?.camera },
        layout: { ...baseProps.layout, ...overrides?.layout },
    };

    // 6. Validate Contract (Strict Schema Check)
    // This fails hard if the resulting props are invalid, ensuring reliability
    return RemotionPropsSchema.parse(finalProps);
}
