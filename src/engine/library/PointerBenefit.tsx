import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { GlassContainer } from './GlassContainer';

export const PointerBenefit: React.FC<{
    label: string;
    x: number;
    y: number;
    dotColor?: string;
}> = ({ label, x, y, dotColor = '#ffffff' }) => {
    const { width, height } = useVideoConfig();

    const left = (x / 100) * width;
    const top = (y / 100) * height;

    return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
            {/* The SVG Line & Dot Canvas */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                <circle
                    cx={left}
                    cy={top}
                    r={3.5}
                    fill="transparent"
                    stroke={dotColor}
                    strokeWidth={1.5}
                />
                <circle
                    cx={left}
                    cy={top}
                    r={1}
                    fill={dotColor}
                />
                <path
                    d={`M ${left + 4} ${top} L ${left + 44} ${top}`}
                    stroke={dotColor}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    strokeOpacity={0.8}
                />
            </svg>

            {/* The Text Box */}
            <GlassContainer
                intensity="heavy"
                padding="6px 14px"
                borderRadius={4}
                style={{
                    position: 'absolute',
                    left: left + 52,
                    top: top - 15, // Center text vertically with dot
                    color: '#ffffff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 20,
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
            >
                {label}
            </GlassContainer>
        </AbsoluteFill>
    );
};
