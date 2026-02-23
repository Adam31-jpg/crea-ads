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
        logoPosition,
    } = props;

    const isDev = process.env.NODE_ENV === 'development';
    const shouldBlur = enableMotionBlur && !isDev;

    const { kick } = useBeat(audio?.bpm || 120);
    const beatScale = 1 + kick * 0.05;

    const baseFontSize    = 60 * layout.contentScale;
    const dynamicFontSize = headlineText.length > 20 ? baseFontSize * 0.6 : baseFontSize;
    const subheadSize     = 30 * layout.contentScale;

    const backgroundStyle: React.CSSProperties = {
        backgroundColor: colors.background,
        background: props.backgroundImageUrl
            ? undefined
            : `linear-gradient(to bottom, ${colors.background}, ${colors.secondary})`,
    };

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

                        {/* ── Layer 0: Background image ── */}
                        {props.backgroundImageUrl && (
                            <AbsoluteFill style={{ zIndex: 0 }}>
                                <Img
                                    src={props.backgroundImageUrl}
                                    crossOrigin="anonymous"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        zIndex: 0,
                                    }}
                                />
                            </AbsoluteFill>
                        )}

                        {/* ── Layer 1: 3D product ── */}
                        <AbsoluteFill style={{ transform: `scale(${beatScale})`, zIndex: 10 }}>
                            <HeroObject
                                imageUrl={productImageUrl}
                                zoom={camera.zoomStart}
                                color={colors.accent}
                                layoutType={layout.layoutType}
                                aspectRatio={layout.aspectRatio}
                            />
                        </AbsoluteFill>

                        {/* ── Layer 2: Safe zone + UI text + logo ── */}
                        <AbsoluteFill style={{ zIndex: 20 }}>
                            <SafeZone aspectRatio={layout.aspectRatio}>
                                {props.elements && props.elements.length > 0 ? (
                                    props.elements.map(el => {
                                        const isHeadline   = el.type === 'headline';
                                        const fontSize     = isHeadline ? dynamicFontSize : el.type === 'subheadline' ? subheadSize : subheadSize * 0.8;
                                        const color        = isHeadline ? colors.textPrimary : colors.accent;
                                        const fontWeight   = isHeadline ? 'bold' : 300;
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
                                                textTransform: textTransform as React.CSSProperties['textTransform'],
                                                letterSpacing: isHeadline ? '0.05em' : 'normal',
                                                lineHeight: 1.1,
                                                whiteSpace: 'pre-wrap',
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
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        textAlign: 'center',
                                        gap: 20,
                                        width: '100%',
                                    }}>
                                        <h1 style={{
                                            fontFamily,
                                            color: colors.textPrimary,
                                            fontSize: dynamicFontSize,
                                            margin: 0,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            maxWidth: '90%',
                                            lineHeight: 1.1,
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

                                {logoUrl && logoPosition && (
                                    <BrandLogo src={logoUrl} position={logoPosition} />
                                )}
                            </SafeZone>
                        </AbsoluteFill>

                    </AbsoluteFill>
                </TransitionLayer>
            </ContentWrapper>
        </AudioLayer>
    );
};
