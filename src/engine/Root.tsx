import React from 'react';
import { Composition } from 'remotion';
import { MasterComposition } from './compositions/MasterComposition';
import { RemotionPropsSchema } from './schema/project';
import { resolveDesign } from '../lib/adapter/design-adapter';
import './style.css';

// 1. Define the Creative Intents for Verification
const luxuryIntent = {
    visualStyle: 'luxury_minimal' as const,
    cameraMotion: 'orbit_center' as const,
    colorMood: 'midnight' as const,
    emphasis: 'product_detail' as const,
    copyTone: 'elegant' as const,
    layoutType: 'converter' as const,
};

// 2. Resolve Props using the Adapter
// Using a base64 placeholder to ensure headless rendering works without network issues
const placeholderImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const luxuryProps = resolveDesign(luxuryIntent, {
    productImageUrl: placeholderImage,
    headlineText: "Lumina Glow",
    subheadlineText: "Radiate Confidence"
});

const verticalOverrides = {
    layout: { layoutType: 'converter' as const, aspectRatio: '9:16' as const, safePadding: 140, contentScale: 0.85 },
    component_layout: [
        {
            component: "PointerBenefit",
            props: { label: "Hydration Lock", x: 75, y: 40 }
        },
        {
            component: "SocialBadge",
            props: { label: "DERMATOLOGIST APPROVED", x: 10, y: 15 }
        }
    ]
};

const verticalProps = resolveDesign(luxuryIntent, {
    productImageUrl: placeholderImage,
    headlineText: "Vertical Mode",
    subheadlineText: "Social Ready",
    ...verticalOverrides
});

export const RemotionRoot: React.FC = () => {
    return (
        <>
            {/* ── 9:16 Portrait (1080 × 1920) — most common social format ── */}
            <Composition
                id="LuxuryPreview-9-16"
                component={MasterComposition}
                durationInFrames={180}
                fps={30}
                width={1080}
                height={1920}
                schema={RemotionPropsSchema}
                defaultProps={verticalProps}
            />

            {/* ── 1:1 Square (1080 × 1080) ── */}
            <Composition
                id="LuxuryPreview-1-1"
                component={MasterComposition}
                durationInFrames={180}
                fps={30}
                width={1080}
                height={1080}
                schema={RemotionPropsSchema}
                defaultProps={luxuryProps}
            />

            {/* ── 16:9 Landscape (1920 × 1080) ── */}
            <Composition
                id="LuxuryPreview-16-9"
                component={MasterComposition}
                durationInFrames={180}
                fps={30}
                width={1920}
                height={1080}
                schema={RemotionPropsSchema}
                defaultProps={luxuryProps}
            />

            {/* ── 4:5 Portrait (1080 × 1350) — Instagram feed ── */}
            <Composition
                id="LuxuryPreview-4-5"
                component={MasterComposition}
                durationInFrames={180}
                fps={30}
                width={1080}
                height={1350}
                schema={RemotionPropsSchema}
                defaultProps={verticalProps}
            />

            {/* ── Legacy alias — kept so any previously stored template_id still resolves ── */}
            <Composition
                id="LuxuryPreview"
                component={MasterComposition}
                durationInFrames={180}
                fps={30}
                width={1080}
                height={1920}
                schema={RemotionPropsSchema}
                defaultProps={verticalProps}
            />

            {/* ── Local dev vertical preview (alias) ── */}
            <Composition
                id="VerticalPreview"
                component={MasterComposition}
                durationInFrames={180}
                fps={30}
                width={1080}
                height={1920}
                schema={RemotionPropsSchema}
                defaultProps={verticalProps}
            />
        </>
    );
};
