import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

export const ScrollingRibbon: React.FC<{
    text: string;
    position: 'top' | 'bottom';
    color?: string;
    bgColor?: string;
}> = ({ text, position = 'bottom', color = '#000000', bgColor = '#FFD700' }) => {
    const frame = useCurrentFrame();

    // Constant scroll speed
    const offset = (frame * 3) % 400;

    return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <div
                style={{
                    position: 'absolute',
                    left: -20,
                    right: -20,
                    [position]: 60,
                    height: 54,
                    backgroundColor: bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    transform: position === 'top' ? 'rotate(-2deg)' : 'rotate(2deg)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
            >
                <div style={{
                    display: 'flex',
                    transform: `translateX(-${offset}px)`,
                }}>
                    {[...Array(20)].map((_, i) => (
                        <div key={i} style={{
                            color: color,
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 24,
                            fontWeight: 800,
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            padding: '0 32px',
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                            {text} <span style={{ marginLeft: 64, opacity: 0.5 }}>•</span>
                        </div>
                    ))}
                </div>
            </div>
        </AbsoluteFill>
    );
};
