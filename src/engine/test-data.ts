import { resolveDesign } from '../lib/adapter/design-adapter';

// Real external image (Coke can or similar) to test AssetLoader
// We can use a reliable public URL or the placeholder if network is flaky
// Using a reliable placeholder for now, but user can swap this
export const TEST_IMAGE_URL = "https://images.unsplash.com/photo-1629203851122-3726ecdf080c?q=80&w=1000&auto=format&fit=crop";
// Fallback if unsplash fails/blocks: "https://remotion.dev/img/logo-small.png"

export const luxuryIntent = {
    visualStyle: 'luxury_minimal' as const,
    cameraMotion: 'orbit_center' as const,
    colorMood: 'midnight' as const,
    emphasis: 'product_detail' as const,
    copyTone: 'elegant' as const,
    layoutType: 'converter' as const,
};

export const RemoteImageScenario = resolveDesign(luxuryIntent, {
    productImageUrl: "https://remotion.dev/img/logo-small.png",
    headlineText: "Remote Asset Loaded",
    subheadlineText: "No more base64"
});

export const LongTextScenario = resolveDesign(luxuryIntent, {
    productImageUrl: "https://remotion.dev/img/logo-small.png",
    headlineText: "THIS IS A VERY LONG HEADLINE THAT SHOULD AUTOMATICALLY SCALE DOWN TO FIT THE SAFE ZONE WITHOUT BREAKING THE LAYOUT",
    subheadlineText: "And this is the subheadline"
});

export const MissingAssetScenario = resolveDesign(luxuryIntent, {
    productImageUrl: "https://invalid-url.com/missing.png", // specific broken URL to test error state
    headlineText: "Missing Asset Test",
});
