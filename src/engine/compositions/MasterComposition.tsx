import React, { useEffect, useState } from 'react';
import { AbsoluteFill, useVideoConfig, Img, delayRender, continueRender } from 'remotion';
import { preloadImage } from '@remotion/preload';
import { z } from 'zod';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { HeroObject } from './HeroObject';
import { SafeZone } from './SafeZone';
import { RemotionPropsSchema } from '../schema/project';
import { useBeat } from '../hooks/useBeat';
import { AudioLayer } from '../components/AudioLayer';
import { TransitionLayer } from '../components/TransitionLayer';
import { BrandLogo } from '../components/BrandLogo';
import { ArrowLayer } from '../components/ArrowLayer';
import { LogoBar } from '../components/LogoBar';
import { ScrimLayer } from '../components/ScrimLayer';
import { ComponentRegistry } from '../library/index';

type Props = z.infer<typeof RemotionPropsSchema>;

// ─── Text Treatment Renderer ──────────────────────────────────────────────────
// Returns CSS properties split into two layers:
//   containerStyle — applied to the outer positioning div (glass / hero_block)
//   textStyle      — applied to the text node itself (shadow / outline)
const FONT_WEIGHT_MAP = { thin: 100, regular: 300, bold: 700, black: 900 } as const;

type TextTreatment = 'none' | 'shadow' | 'glass' | 'outline' | 'hero_block';
type FontWeightKey = keyof typeof FONT_WEIGHT_MAP;

function getTextTreatmentStyles(treatment: TextTreatment): {
    containerStyle: React.CSSProperties;
    textStyle: React.CSSProperties;
} {
    switch (treatment) {
        case 'glass':
            return {
                containerStyle: {
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    backgroundColor: 'rgba(0,0,0,0.28)',
                    borderRadius: '10px',
                    padding: '8px 16px',
                },
                textStyle: {},
            };
        case 'hero_block':
            return {
                containerStyle: {
                    backgroundColor: 'rgba(0,0,0,0.62)',
                    borderRadius: '4px',
                    padding: '6px 12px',
                },
                textStyle: {},
            };
        case 'outline':
            return {
                containerStyle: {},
                textStyle: {
                    WebkitTextStroke: '1.5px rgba(0,0,0,0.85)',
                    textShadow: '0 0 6px rgba(0,0,0,0.45)',
                },
            };
        case 'shadow':
            return {
                containerStyle: {},
                textStyle: {
                    textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.5)',
                },
            };
        case 'none':
        default:
            return { containerStyle: {}, textStyle: {} };
    }
}

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
        sceneLightDirection,
        contactSurface,
        compositionIntent = 'direct_response',
        lightingIntent,
        productImageUrls,
        hideHeroObject = false,
        layout_config,
    } = props;

    const isDev = process.env.NODE_ENV === 'development';
    const shouldBlur = enableMotionBlur && !isDev;

    const { kick } = useBeat(audio?.bpm || 120);
    const beatScale = 1 + kick * 0.05;

    const baseFontSize = 60 * layout.contentScale;
    // Cinematic intent uses an oversized headline — 1.8× — to fill the frame with type.
    const cinematicScale = compositionIntent === 'cinematic' ? 1.8 : 1;
    const dynamicFontSize = (headlineText.length > 20 ? baseFontSize * 0.6 : baseFontSize) * cinematicScale;
    const subheadSize = 30 * layout.contentScale;

    // Derive product URL list: bundle array takes precedence over single URL.
    const resolvedImageUrls = (productImageUrls && productImageUrls.length > 0)
        ? productImageUrls
        : [productImageUrl];
    // 🔍 REMOTE-DEBUG — if this never appears in the terminal, Lambda is running a stale bundle.
    // Fix: run `npm run deploy:site` to re-upload the engine bundle to S3.
    console.log('🚀 [REMOTE-DEBUG] MasterComposition v2 is MOUNTED — bundle is fresh.');
    console.log(`🔗 [REMOTE-DEBUG] backgroundImageUrl received: ${JSON.stringify(props.backgroundImageUrl ?? null)}`);

    const [bgReady, setBgReady] = useState(!props.backgroundImageUrl);

    useEffect(() => {
        if (!props.backgroundImageUrl) {
            setBgReady(true);
            return;
        }

        // Belt #1 — @remotion/preload: tells Remotion to prefetch the URL before
        // any frame is composited. Returns a cleanup function.
        const { free } = preloadImage(props.backgroundImageUrl);

        // Belt #2 — explicit delayRender/continueRender: Lambda captures frames
        // concurrently and can race ahead of the Img onLoad callback. Holding a
        // delay handle guarantees the compositor waits for this resolve.
        const handle = delayRender(
            `[MasterComposition] Loading background: ${props.backgroundImageUrl.slice(0, 80)}`
        );

        const img = new window.Image();
        img.onload = () => {
            setBgReady(true);
            continueRender(handle);
        };
        img.onerror = () => {
            // Log the failure so it appears in Lambda CloudWatch / Next.js terminal
            console.error(
                `[MasterComposition] Background image failed to load. ` +
                `URL: ${props.backgroundImageUrl}\n` +
                `Check that the S3 bucket policy allows public read access.`
            );
            // Unblock render — show gradient fallback rather than a hung render.
            setBgReady(true);
            continueRender(handle);
        };
        img.src = props.backgroundImageUrl;

        return () => {
            free();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.backgroundImageUrl]);

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
                        {props.backgroundImageUrl && bgReady && (
                            <AbsoluteFill style={{ zIndex: 0 }}>
                                <Img
                                    src={props.backgroundImageUrl}
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

                        {/* ── Layer 1: Scrim — text-protection gradient over background ── */}
                        {layout_config && (
                            <ScrimLayer layout_config={layout_config} />
                        )}

                        {/* ── Layer 1: 3D product ── */}
                        {/* Suppressed for still images where BRIA has already baked the product */}
                        {/* into the background — rendering both would create a double-layer artifact. */}
                        {!hideHeroObject && (
                            <AbsoluteFill style={{ transform: `scale(${beatScale})`, zIndex: 10 }}>
                                <HeroObject
                                    imageUrl={productImageUrl}
                                    productImageUrls={resolvedImageUrls}
                                    zoom={camera.zoomStart}
                                    color={colors.accent}
                                    layoutType={layout.layoutType}
                                    aspectRatio={layout.aspectRatio}
                                    sceneLightDirection={sceneLightDirection}
                                    contactSurface={contactSurface}
                                    lightingIntent={lightingIntent}
                                />
                            </AbsoluteFill>
                        )}

                        {/* ── Layer 2: Safe zone + Components / Legacy Overlays ── */}
                        <AbsoluteFill style={{ zIndex: 20 }}>
                            <SafeZone aspectRatio={layout.aspectRatio}>
                                {props.component_layout && props.component_layout.length > 0 ? (
                                    /* ── NEXT-GEN: Lego Component Architecture ── */
                                    props.component_layout.map((config, i) => {
                                        const Component = ComponentRegistry[config.component];
                                        if (!Component) {
                                            console.warn(`[MasterComposition] Unregistered component: ${config.component}`);
                                            return null;
                                        }
                                        return <Component key={i} {...config.props} />;
                                    })
                                ) : (
                                    /* ── LEGACY RENDERER: Graceful fallback for old jobs ── */
                                    <>
                                        {props.elements && props.elements.length > 0 ? (
                                            props.elements.map(el => {
                                                const isHeadline = el.type === 'headline';
                                                const fontSize = isHeadline ? dynamicFontSize : el.type === 'subheadline' ? subheadSize : subheadSize * 0.8;
                                                const color = isHeadline ? colors.textPrimary : colors.accent;
                                                const textTransform = isHeadline ? 'uppercase' : 'none';

                                                const weightKey = (el as typeof el & { font_weight?: FontWeightKey }).font_weight;
                                                const fontWeight: number = weightKey
                                                    ? FONT_WEIGHT_MAP[weightKey]
                                                    : (isHeadline ? 700 : 300);

                                                const rawTreatment = (el as typeof el & { text_treatment?: string }).text_treatment;
                                                const treatment: TextTreatment =
                                                    ['none', 'shadow', 'glass', 'outline', 'hero_block'].includes(rawTreatment ?? '')
                                                        ? (rawTreatment as TextTreatment)
                                                        : 'shadow';
                                                const { containerStyle, textStyle } = getTextTreatmentStyles(
                                                    el.type === 'cta' ? 'none' : treatment
                                                );

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
                                                        ...containerStyle,
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
                                                            <span style={textStyle}>{el.content}</span>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : null /* empty elements = intentional editorial/cinematic canvas */}

                                        {/* ── Social proof stars (★★★★★) from layout_config ── */}
                                        {layout_config?.social_proof && (
                                            <div style={{
                                                position: 'absolute',
                                                left: `${layout_config.social_proof.x}%`,
                                                top: `${layout_config.social_proof.y}%`,
                                                transform: `scale(${layout_config.social_proof.scale})`,
                                                transformOrigin: 'top left',
                                                zIndex: 22,
                                                color: colors.accent,
                                                fontSize: 28,
                                                display: 'flex',
                                                gap: 3,
                                                filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))',
                                            }}>
                                                {'★★★★★'}
                                            </div>
                                        )}

                                        {/* ── Bezier arrow from layout_config ── */}
                                        {layout_config?.arrow && (
                                            <ArrowLayer
                                                arrow={layout_config.arrow}
                                                color={colors.accent}
                                                strokeWidth={3}
                                            />
                                        )}

                                        {logoUrl && logoPosition && (
                                            <BrandLogo src={logoUrl} position={logoPosition} />
                                        )}
                                    </>
                                )}
                            </SafeZone>
                        </AbsoluteFill>

                        {/* ── Layer 3: LogoBar trust strip from layout_config ── */}
                        {layout_config?.trust_bar && (
                            <AbsoluteFill style={{ zIndex: 24, pointerEvents: 'none' }}>
                                <LogoBar
                                    trust_bar={layout_config.trust_bar}
                                    accentColor={colors.accent}
                                />
                            </AbsoluteFill>
                        )}

                    </AbsoluteFill>
                </TransitionLayer>
            </ContentWrapper>
        </AudioLayer>
    );
};
