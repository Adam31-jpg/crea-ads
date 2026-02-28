import React from 'react';
import { AbsoluteFill } from 'remotion';
import { GlassContainer } from './GlassContainer';

export const BenefitGrid: React.FC<{
    x: number;
    y: number;
    benefits: string[]; // Array of 4 strings recommended
    accentColor?: string;
}> = ({ x, y, benefits, accentColor = '#ffffff' }) => {

    const CheckIcon = () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );

    return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <GlassContainer
                intensity="medium"
                padding="20px 24px"
                borderRadius={16}
                style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    columnGap: 32,
                    rowGap: 16,
                }}
            >
                {benefits.slice(0, 4).map((text, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CheckIcon />
                        <span style={{
                            color: '#ffffff',
                            fontSize: 18,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                        }}>
                            {text}
                        </span>
                    </div>
                ))}
            </GlassContainer>
        </AbsoluteFill>
    );
};
