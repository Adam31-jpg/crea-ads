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
    layout: { aspectRatio: '9:16' as const, safePadding: 140, contentScale: 0.85 }
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
            {/* Scenario A: Luxury Minimal (1:1) */}
            <Composition
                id="LuxuryPreview"
                component={MasterComposition}
                durationInFrames={150}
                fps={30}
                width={1080}
                height={1080}
                schema={RemotionPropsSchema}
                defaultProps={luxuryProps}
            />

            {/* Scenario B: Vertical Layout (9:16) */}
            <Composition
                id="VerticalPreview"
                component={MasterComposition}
                durationInFrames={150}
                fps={30}
                width={1080}
                height={1920}
                schema={RemotionPropsSchema}
                defaultProps={verticalProps}
            />
        </>
    );
};
