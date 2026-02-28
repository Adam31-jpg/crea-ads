import React from 'react';
import { AbsoluteFill } from 'remotion';

export const OutlineText: React.FC<{
    text: string;
    x: number;
    y: number;
    fontSize?: number;
    color?: string;
}> = ({ text, x, y, fontSize = 240, color = '#ffffff' }) => {
    return (
        <AbsoluteFill style={{ pointerEvents: 'none', zIndex: -1 }}>
            <div
                style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    color: 'transparent',
                    fontFamily: 'Inter, sans-serif',
                    fontSize,
                    fontWeight: 900,
                    WebkitTextStroke: `2px ${color}`,
                    opacity: 0.15, // Blends into the studio background
                    letterSpacing: '-0.04em',
                    lineHeight: 0.8,
                    transform: 'translate(-50%, -50%)',
                    whiteSpace: 'nowrap',
                }}
            >
                {text}
            </div>
        </AbsoluteFill>
    );
};
