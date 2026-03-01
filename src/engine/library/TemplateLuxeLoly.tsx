import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { HeroObject } from '../compositions/HeroObject';
import { BrandHeader } from './BrandHeader';
import { GlassCard } from './GlassCard';
import { FeatureSwitch } from './FeatureSwitch';
import { CleanIngredient } from './CleanIngredient';
import { PointerBenefit } from './PointerBenefit';

export const TemplateLuxeLoly: React.FC<any> = ({
    props,
    resolvedImageUrls,
    beatScale
}) => {
    const { width, height } = useVideoConfig();
    const isPortrait = width < height;

    // Force all S3 assets to use CloudFront to bypass bucket read permissions
    const AWS_CLOUDFRONT_URL = "https://d1zfhdugugdhgw.cloudfront.net";
    const applyCDN = (url?: string) => {
        if (!url) return url;
        if (url.includes('lumina-assets-prod.s3.us-east-1.amazonaws.com')) {
            return url.replace('https://lumina-assets-prod.s3.us-east-1.amazonaws.com', AWS_CLOUDFRONT_URL);
        }
        return url;
    };

    const cdnImageUrl = applyCDN(props.productImageUrl);
    const cdnResolvedUrls = resolvedImageUrls?.map(applyCDN) || [];

    // Responsive split: Portrait = top/bottom (40/60). Landscape = left/right (45/55).
    const flexDirection = isPortrait ? 'column' : 'row';
    const split1 = isPortrait ? '40%' : '45%';
    const split2 = isPortrait ? '60%' : '55%';

    let brandName = "LES SECRETS DE LOLY";
    let features: string[] = [];

    // Extract BrandName and USPs from props.component_layout
    if (props.component_layout) {
        props.component_layout.forEach((c: any) => {
            if (c.component === 'BrandHeader') brandName = c.props.brandName;
            if (c.component === 'FeatureCard' || c.component === 'GlassCard') {
                features = c.props.features || [];
            }
        });
    }

    if (features.length === 0 && props.elements) {
        // Fallback to old element format if empty
        features = props.elements.filter((e: any) => e.type === 'subheadline').map((e: any) => e.content);
    }

    // Default features if completely empty
    if (features.length === 0) features = ['FREINE LA CHUTE DE CHEVEUX', 'BOOSTE LA CROISSANCE', 'RENFORCE LA FIBRE'];

    return (
        <AbsoluteFill style={{ display: 'flex', flexDirection, zIndex: 20 }}>
            {/* Left/Top Column: Product Area */}
            <div style={{ width: isPortrait ? '100%' : split1, height: isPortrait ? split1 : '100%', position: 'relative' }}>
                <AbsoluteFill style={{ transform: `scale(${beatScale})`, zIndex: 10 }}>
                    {!props.backgroundImageUrl && (
                        <HeroObject
                            imageUrl={cdnImageUrl}
                            productImageUrls={cdnResolvedUrls}
                            zoom={props.camera.zoomStart}
                            color={props.colors.accent}
                            layoutType={props.layout.layoutType}
                            aspectRatio={props.layout.aspectRatio}
                            sceneLightDirection={props.sceneLightDirection}
                            contactSurface={props.contactSurface}
                            lightingIntent={props.lightingIntent}
                        />
                    )}
                </AbsoluteFill>
            </div>

            {/* Right/Bottom Column: Typography & USPs */}
            <div style={{
                width: isPortrait ? '100%' : split2,
                height: isPortrait ? split2 : '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isPortrait ? '20px 40px' : '40px 60px',
                gap: '40px',
                zIndex: 20
            }}>
                <BrandHeader brandName={brandName} isRelative={true} />

                <GlassCard style={{ width: '100%', maxWidth: '440px' }}>
                    {features.map((feature, i) => (
                        <FeatureSwitch
                            key={i}
                            label={feature}
                            isActive={true}
                            activeColor={props.colors.primary}
                            isRelative={true}
                        />
                    ))}
                </GlassCard>

                {/* Dynamically render any other strict components injected by Gemini */}
                {props.component_layout?.map((c: any, i: number) => {
                    if (c.component === 'CleanIngredient') return <CleanIngredient key={`extra-${i}`} {...c.props} isRelative={true} />;
                    if (c.component === 'PointerBenefit') return <PointerBenefit key={`extra-${i}`} {...c.props} isRelative={true} />;
                    return null;
                })}

                {/* Internal Social Proof perfectly aligned under the card */}
                <div style={{
                    color: props.colors.accent,
                    fontSize: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                    marginTop: 10,
                }}>
                    <div style={{
                        display: 'flex',
                        gap: 4,
                        fontSize: 28
                    }}>
                        ★★★★★
                    </div>
                    <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase'
                    }}>
                        N°1 DES SOINS TEXTURÉS
                    </span>
                </div>

                {/* Responsive directional arrow pointing from Card to Product */}
                {!isPortrait && (
                    <div style={{
                        position: 'absolute',
                        left: '-40px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 30,
                    }}>
                        <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M58 12L2 12M2 12L12 2M2 12L12 22" stroke={props.colors.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                )}
            </div>
        </AbsoluteFill>
    );
};
