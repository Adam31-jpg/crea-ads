import React from 'react';
import { AbsoluteFill, Img, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { RemotionPropsSchema } from '../schema/project';
import { BrandHeader } from './BrandHeader';

type Props = z.infer<typeof RemotionPropsSchema>;

export const TemplateOverheadMinimal: React.FC<Props> = (props) => {
    const { width, height } = useVideoConfig();
    const isPortrait = height > width;

    // Extract brandName dynamically if available in components
    let brandName = "LUMINA";
    if (props.component_layout) {
        props.component_layout.forEach((c: any) => {
            if (c.component === 'BrandHeader') {
                brandName = c.props.brandName;
            }
        });
    }

    // Reconstruct URLs just like in Loly
    const bucketUrl = "https://lumina-remotion-projects.s3.us-east-1.amazonaws.com";
    let cdnImageUrl = props.backgroundImageUrl;
    if (cdnImageUrl && cdnImageUrl.startsWith('s3://')) {
        cdnImageUrl = cdnImageUrl.replace('s3://lumina-remotion-projects/', bucketUrl + '/');
    }

    return (
        <AbsoluteFill style={{ backgroundColor: props.colors.background }}>

            {/* Background Layer: Flat 2D Image */}
            <AbsoluteFill style={{ zIndex: 10 }}>
                {cdnImageUrl && (
                    <Img
                        src={cdnImageUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }}
                    />
                )}
            </AbsoluteFill>

            {/* Spatial Placeholder: Red Cube simulating Nano Banana product placement */}
            {props.isSandboxMock && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '40%', // Slightly leaning left
                    transform: 'translate(-50%, -50%)',
                    width: '45%',
                    height: '50%',
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
                    AI FLAT-LAY <br /> PRODUCT AREA
                </div>
            )}

            {/* Master Overlay Layer (Typography & UI) */}
            <div style={{ width: '100%', height: '100%', zIndex: 20, position: 'absolute', top: 0, left: 0 }}>

                {/* Headline (Top-Right Anchor) */}
                <div style={{
                    position: 'absolute',
                    top: '20%',
                    right: '10%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    zIndex: 30,
                    maxWidth: isPortrait ? '80%' : '40%'
                }}>
                    <h1 style={{
                        fontFamily: props.fontFamily || 'Inter',
                        fontSize: isPortrait ? '64px' : '72px',
                        fontWeight: 300, // Minimalist weight
                        lineHeight: 1.1,
                        color: props.colors.textPrimary || '#FFFFFF',
                        textAlign: 'right',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        margin: 0,
                        textShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}>
                        {props.headlineText || "PURE ESSENCE"}
                    </h1>
                </div>

                {/* Logo (Bottom-Right Anchor) */}
                <div style={{
                    position: 'absolute',
                    bottom: '5%',
                    right: '5%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    zIndex: 30
                }}>
                    {props.logoUrl ? (
                        <Img
                            src={props.logoUrl}
                            style={{
                                height: isPortrait ? '40px' : '50px',
                                objectFit: 'contain'
                            }}
                        />
                    ) : (
                        <BrandHeader brandName={brandName} isRelative={true} />
                    )}
                </div>

            </div>

        </AbsoluteFill>
    );
};
