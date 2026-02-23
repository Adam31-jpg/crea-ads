import React from 'react';
import { AbsoluteFill, useVideoConfig, Img } from 'remotion';
import { z } from 'zod';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { HeroObject } from './HeroObject';
import { SafeZone } from './SafeZone';
import { RemotionPropsSchema } from '../schema/project';
import { useBeat } from '../hooks/useBeat';
import { AudioLayer } from '../components/AudioLayer';
import { TransitionLayer } from '../components/TransitionLayer';
import { BrandLogo } from '../components/BrandLogo';

type Props = z.infer<typeof RemotionPropsSchema>;

export const MasterComposition: React.FC<Props> = (props) => {
    const {
        productImageUrl,
        colors,
        fontFamily,
        headlineText,
        layout,
        camera,
        audio,
        transition,
        enableMotionBlur,
        logoUrl,
        logoPosition
    } = props;

    // Motion Blur Logic
    // Only enable if requested AND we are not in simple dev mode (unless forced)
    // User requested: "disable if process.env.NODE_ENV === 'development'"
    // However, we want to be able to test it.
    // Let's settle on: Enabled if prop is true.
    // The conditional logic (NODE_ENV) should be handled by the Caller (Root.tsx or API),
    // OR we strict disable it here.
    // Let's respect the prop strictly. The Caller ensures the prop is false in dev if desired.
    // User specifically asked "implement a logic that automatically disables...".
    // We'll wrap the logic here for safety.
    const isDev = process.env.NODE_ENV === 'development';
    const shouldBlur = enableMotionBlur && !isDev;

    // Beat Sync Logic
    // Default to 120bpm if not provided
    const { kick } = useBeat(audio?.bpm || 120);
    // Apply kick to HeroObject zoom (subtle pulse)
    const beatScale = 1 + (kick * 0.05); // 5% pulse on beat

    // Dynamic Text Sizing Logic
    // If headline is long (> 20 chars), reduce font size to prevent overflow
    const baseFontSize = 60 * layout.contentScale;
    const isLongHeadline = headlineText.length > 20;
    // Reduce by 40% if long
    const dynamicFontSize = isLongHeadline ? baseFontSize * 0.6 : baseFontSize;

    // If subheadline is long via some heuristic, we could also scale it, but usually headline is the risk
    const subheadSize = 30 * layout.contentScale;

    const backgroundStyle: React.CSSProperties = {
        backgroundColor: colors.background,
        background: props.backgroundImageUrl ? undefined : `linear-gradient(to bottom, ${colors.background}, ${colors.secondary})`,
    };

    // Helper to wrap content in MotionBlur or Fragment
    const ContentWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        if (shouldBlur) {
            return (
                <CameraMotionBlur samples={4} shutterAngle={180}>
                    {children}
                </CameraMotionBlur>
            );
        }
        return <>{children}</>;
    };

    return (
        <AudioLayer
            audioUrl={audio?.audioUrl}
            volume={audio?.volume}
            startFrom={audio?.startFrom}
        >
            <ContentWrapper>
                <TransitionLayer transition={transition}>

                    <AbsoluteFill style={backgroundStyle}>

                        {/* Layer 0: Background Image Component */}
                        {/* CRITICAL — use explicit 4-sided pinning (top/right/bottom/left: 0) with
                            NO width/height. Combining `inset: 0` with `width: 100%; height: 100%`
                            is overconstrained for position:absolute. The CSS spec resolves conflicts
                            by dropping `bottom` and using `height: 100%` against the containing-block
                            content-area, which in headless Chromium can return ~50% of the intended
                            height — producing the "top-half image, bottom-half dark" split.
                            Using only the 4 edge pins lets the browser derive size without conflict.
                            Tailwind classes are intentionally absent: they are not guaranteed to be
                            present in Remotion Lambda's stripped CSS bundle. */}
                        {props.backgroundImageUrl && (
                            <Img
                                src={props.backgroundImageUrl}
                                crossOrigin="anonymous"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    objectFit: 'cover',
                                    zIndex: 0,
                                }}
                            />
                        )}

                        {/* Layer 1: 3D Hero Object — explicit zIndex: 10 sits above the background */}
                        <AbsoluteFill style={{ transform: `scale(${beatScale})`, zIndex: 10 }}>
                            <HeroObject
                                imageUrl={productImageUrl}
                                zoom={camera.zoomStart}
                                color={colors.accent}
                                layoutType={layout.layoutType}
                                aspectRatio={layout.aspectRatio}
                            />
                        </AbsoluteFill>

                        {/* Layer 2: Safe Zone & UI Content — zIndex: 20 sits above the 3D canvas */}
                        <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
                        <SafeZone aspectRatio={layout.aspectRatio}>
                            {props.elements && props.elements.length > 0 ? (
                                props.elements.map(el => {
                                    const isHeadline = el.type === 'headline';
                                    const fontSize = isHeadline ? dynamicFontSize : (el.type === 'subheadline' ? subheadSize : subheadSize * 0.8);
                                    const color = isHeadline ? colors.textPrimary : colors.accent;
                                    const fontWeight = isHeadline ? 'bold' : 300;
                                    const textTransform = isHeadline ? 'uppercase' : 'none';

                                    return (
                                        <div key={el.id} style={{
                                            position: 'absolute',
                                            left: `${el.x}%`,
                                            top: `${el.y}%`,
                                            transform: el.align === 'center' ? 'translateX(-50%)' : 'none',
                                            width: el.width ? `${el.width}%` : 'auto',
                                            textAlign: el.align,
                                            fontFamily,
                                            fontSize,
                                            color,
                                            fontWeight,
                                            textTransform: textTransform as any,
                                            letterSpacing: isHeadline ? '0.05em' : 'normal',
                                            lineHeight: 1.1,
                                            whiteSpace: 'pre-wrap',
                                            zIndex: 10,
                                        }}>
                                            {el.type === 'cta' ? (
                                                <div style={{
                                                    backgroundColor: colors.primary,
                                                    color: '#000',
                                                    padding: '12px 24px',
                                                    borderRadius: '8px',
                                                    display: 'inline-block',
                                                    fontWeight: 'bold',
                                                    fontSize: subheadSize * 0.7,
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {el.content}
                                                </div>
                                            ) : (
                                                el.content
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                // Fallback for old renders without elements array
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center',
                                    gap: 20,
                                    zIndex: 10,
                                    width: '100%', // ensure full width for centering
                                }}>
                                    <h1 style={{
                                        fontFamily,
                                        color: colors.textPrimary,
                                        fontSize: dynamicFontSize,
                                        margin: 0,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        maxWidth: '90%', // Keep it away from edges
                                        lineHeight: 1.1,
                                        // Allow wrapping
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {headlineText}
                                    </h1>

                                    {props.subheadlineText && (
                                        <h2 style={{
                                            fontFamily,
                                            color: colors.accent,
                                            fontSize: subheadSize,
                                            margin: 0,
                                            fontWeight: 300,
                                            maxWidth: '80%',
                                        }}>
                                            {props.subheadlineText}
                                        </h2>
                                    )}
                                </div>
                            )}

                            {/* Layer 3: Brand Logo - Now inside SafeZone */}
                            {logoUrl && logoPosition && (
                                <BrandLogo src={logoUrl} position={logoPosition} />
                            )}
                        </SafeZone>
                        </div>

                    </AbsoluteFill>
                </TransitionLayer>
            </ContentWrapper>
        </AudioLayer>
    );
};
