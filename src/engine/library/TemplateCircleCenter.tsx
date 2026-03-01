import React from 'react';
import { AbsoluteFill, Img, useVideoConfig } from 'remotion';
import { RemotionProps } from '../schema/project';
import { ContactChip } from './ContactChip';

export const TemplateCircleCenter: React.FC<{ props: RemotionProps }> = ({ props }) => {
    const { width, height } = useVideoConfig();
    const isLandscape = width > height;

    // Define the bounding box for the product area (dead center)
    // 1:1 format product box
    const productBoxSize = isLandscape ? height * 0.45 : width * 0.55;

    // Adjust typography based on landscape constraint to prevent overlap
    const typographyContainerStyle: React.CSSProperties = isLandscape
        ? {
            position: 'absolute',
            top: '8%',
            left: '5%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            maxWidth: '35%',
        }
        : {
            position: 'absolute',
            top: '18%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '90%',
            textAlign: 'center' as const,
        };

    const headlineFontSize = isLandscape ? Math.max(32, height * 0.07) : Math.max(36, width * 0.09);
    const subheadlineFontSize = isLandscape ? Math.max(20, height * 0.04) : Math.max(24, width * 0.05);

    return (
        <AbsoluteFill style={{ backgroundColor: props.colors.background }}>
            {/* AI Generated Background Composite (Contains Product & Geometric Circle) */}
            {props.backgroundImageUrl && (
                <Img
                    src={props.backgroundImageUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: 'absolute',
                    }}
                />
            )}

            {/* Sandbox Product Area Mock - Shows the exact zone Nano Banana uses */}
            {props.isSandboxMock && !props.backgroundImageUrl && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: `${productBoxSize}px`,
                    height: `${productBoxSize}px`,
                    border: '4px dashed red',
                    backgroundColor: 'rgba(255,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'red',
                    fontWeight: 'bold',
                    fontSize: '24px'
                }}>
                    PRODUCT AREA
                </div>
            )}

            {/* Typography: Dual Color Stack */}
            {(props.headlineText || props.subheadlineText) && (
                <div style={typographyContainerStyle}>
                    {props.headlineText && (
                        <h1 style={{
                            margin: 0,
                            fontFamily: props.fontFamily || 'Inter',
                            fontSize: `${headlineFontSize}px`,
                            fontWeight: 900,
                            color: props.colors.textPrimary,
                            lineHeight: 1.1,
                            textTransform: 'uppercase',
                            textShadow: '0 4px 20px rgba(0,0,0,0.4)',
                            textAlign: isLandscape ? 'left' : 'center'
                        }}>
                            {props.headlineText}
                        </h1>
                    )}

                    {props.subheadlineText && (
                        <h2 style={{
                            margin: '12px 0 0 0',
                            fontFamily: props.fontFamily || 'Inter',
                            fontSize: `${subheadlineFontSize}px`,
                            fontWeight: 600,
                            color: props.colors.accent, // Accent color for the dual-color effect
                            lineHeight: 1.2,
                            textShadow: '0 4px 15px rgba(0,0,0,0.4)',
                            textAlign: isLandscape ? 'left' : 'center'
                        }}>
                            {props.subheadlineText}
                        </h2>
                    )}
                </div>
            )}

            {/* Logo: Top-Right */}
            {props.logoUrl && (
                <Img
                    src={props.logoUrl}
                    style={{
                        position: 'absolute',
                        top: '5%',
                        right: '5%',
                        width: isLandscape ? '10%' : '15%',
                        maxWidth: '120px',
                        objectFit: 'contain'
                    }}
                />
            )}

            {/* Contact Information Pill */}
            <ContactChip props={props} />

        </AbsoluteFill>
    );
};
