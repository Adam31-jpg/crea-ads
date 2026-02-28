import React from 'react';
import { AbsoluteFill } from 'remotion';
import { GlassContainer } from './GlassContainer';

export const CleanIngredient: React.FC<{
    x: number;
    y: number;
    ingredient: string;
    subtext?: string;
    accentColor?: string;
}> = ({ x, y, ingredient, subtext = 'Pure Active', accentColor = '#ffffff' }) => {
    return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <GlassContainer
                intensity="heavy"
                padding="24px"
                borderRadius={100} // Circular
                style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${accentColor}55`, // Subtle color tint
                    minWidth: 120,
                    minHeight: 120,
                }}
            >
                <div style={{
                    color: accentColor,
                    fontSize: 12,
                    fontFamily: 'Inter, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontWeight: 600,
                    marginBottom: 4,
                }}>
                    + {subtext}
                </div>
                <div style={{
                    color: '#ffffff',
                    fontSize: 24,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 400, // Clean, airy weight
                    letterSpacing: '0.02em',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    textAlign: 'center',
                }}>
                    {ingredient}
                </div>
            </GlassContainer>
        </AbsoluteFill>
    );
};
