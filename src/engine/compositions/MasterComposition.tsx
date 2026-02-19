import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { HeroObject } from './HeroObject';
import { SafeZone } from './SafeZone';
import { RemotionPropsSchema } from '../schema/project';

// We use the schema inferred type for props
type Props = z.infer<typeof RemotionPropsSchema>;

export const MasterComposition: React.FC<Props> = (props) => {
    const {
        productImageUrl,
        colors,
        fontFamily,
        headlineText,
        layout,
        camera
    } = props;

    const { width, height } = useVideoConfig();

    // Background Style
    const backgroundStyle: React.CSSProperties = {
        backgroundColor: colors.background,
        // Add a subtle gradient if needed, or use backgroundImageUrl if provided
        background: props.backgroundImageUrl ? `url(${props.backgroundImageUrl})` : `linear-gradient(to bottom, ${colors.background}, ${colors.secondary})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };

    return (
        <AbsoluteFill style={backgroundStyle}>

            {/* Layer 1: 3D Hero Object */}
            {/* We pass zoom/camera info here */}
            <AbsoluteFill>
                <HeroObject imageUrl={productImageUrl} zoom={camera.zoomStart} />
            </AbsoluteFill>

            {/* Layer 2: Safe Zone & UI Content */}
            <SafeZone aspectRatio={layout.aspectRatio} debug={true}>
                {/* Text Content Container */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 20,
                    zIndex: 10,
                }}>
                    <h1 style={{
                        fontFamily,
                        color: colors.textPrimary,
                        fontSize: 60 * layout.contentScale,
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        maxWidth: '80%', // Ensure it doesn't touch edges even inside safe zone
                    }}>
                        {headlineText}
                    </h1>

                    {props.subheadlineText && (
                        <h2 style={{
                            fontFamily,
                            color: colors.accent,
                            fontSize: 30 * layout.contentScale,
                            margin: 0,
                            fontWeight: 300,
                        }}>
                            {props.subheadlineText}
                        </h2>
                    )}
                </div>
            </SafeZone>

        </AbsoluteFill>
    );
};
