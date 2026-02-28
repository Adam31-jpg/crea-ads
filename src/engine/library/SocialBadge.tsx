import React from 'react';
import { AbsoluteFill } from 'remotion';
import { GlassContainer } from './GlassContainer';

export const SocialBadge: React.FC<{
    x: number;
    y: number;
    label: string; // e.g. "Verified Result" or "4.9/5 Rating"
    starColor?: string;
}> = ({ x, y, label, starColor = '#FFD700' }) => {

    const renderStar = (key: number) => (
        <svg
            key={key}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={starColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0px 0px 4px ${starColor}44)` }}
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );

    return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <GlassContainer
                intensity="medium"
                padding="10px 18px"
                borderRadius={20}
                style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    // Optional scaling based on a responsive wrapper later, but we use fixed sizes for premium feel
                }}
            >
                <div style={{ display: 'flex', gap: 4 }}>
                    {[...Array(5)].map((_, i) => renderStar(i))}
                </div>
                <div
                    style={{
                        color: '#ffffff',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 16,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    }}
                >
                    {label}
                </div>
            </GlassContainer>
        </AbsoluteFill>
    );
};
