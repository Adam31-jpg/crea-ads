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
        <AbsoluteFill style={{ backgroundColor: props.colors.background }}>

            {/* Background Layer: Product Area */}
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

            {/* Spatial Placeholder: Red Cube simulating Nano Banana product placement */}
            {props.isSandboxMock && (
                <div style={{
                    position: 'absolute',
                    bottom: '10%',
                    right: '5%',
                    width: '45%',
                    height: '60%',
                    border: '4px dashed #ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    zIndex: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    fontWeight: 'bold',
                    fontSize: isPortrait ? '2rem' : '3rem',
                    textAlign: 'center',
                    backdropFilter: 'blur(2px)',
                    borderRadius: '24px'
                }}>
                    AI PRODUCT <br /> COMPOSITE AREA
                </div>
            )}

            {/* Master Overlay Layer (Typography & UI) */}
            <div style={{ width: '100%', height: '100%', zIndex: 20, position: 'absolute', top: 0, left: 0 }}>

                {/* 1. BLOC DE GAUCHE : Titre + Switchs */}
                <div style={{
                    position: 'absolute',
                    left: '5%',
                    // LA MAGIE : En portrait c'est ancré en bas. En paysage/carré c'est centré verticalement.
                    bottom: isPortrait ? '45%' : 'auto',
                    top: isPortrait ? 'auto' : '50%',
                    transform: isPortrait ? 'none' : 'translateY(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    width: isPortrait ? '90%' : '45%',
                    maxWidth: '500px'
                }}>
                    <h1 style={{
                        fontFamily: props.fontFamily || 'Poppins',
                        fontSize: isPortrait ? '72px' : '64px',
                        fontWeight: 800,
                        lineHeight: 1.05,
                        color: props.colors.textRef || '#FFFFFF',
                        textAlign: 'left',
                        textTransform: 'uppercase',
                        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
                        letterSpacing: '-0.02em',
                        margin: 0
                    }}>
                        {props.headlineText || brandName}
                    </h1>

                    <GlassCard style={{ width: '100%' }}>
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
                </div>

                {/* 2. BLOC DE DROITE : Nom de la marque */}
                <div style={{
                    position: 'absolute',
                    right: isPortrait ? '30%' : '10%',
                    // LA MAGIE : Plus haut en paysage pour survoler le carré rouge
                    bottom: isPortrait ? '80%' : '75%',
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 22
                }}>
                    <BrandHeader brandName={brandName} isRelative={true} />
                </div>

            </div>
        </AbsoluteFill>
    );
};
