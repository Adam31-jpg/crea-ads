import React from 'react';
import { AbsoluteFill } from 'remotion';

export const BackgroundPattern: React.FC<{
    text: string;
    opacity?: number;
    color?: string;
    rotation?: number;
}> = ({ text, opacity = 0.1, color = '#ffffff', rotation = -15 }) => {
    // Generate a repeating string of the text
    const repeatedText = Array(50).fill(text).join(' • ');

    return (
        <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }}>
            <div
                style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    transform: `rotate(${rotation}deg)`,
                    opacity,
                }}
            >
                {Array.from({ length: 40 }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            color,
                            fontFamily: 'Outfit, sans-serif',
                            fontSize: 48,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.5,
                            marginLeft: i % 2 === 0 ? 0 : -100, // Stagger effect
                        }}
                    >
                        {repeatedText}
                    </div>
                ))}
            </div>
        </AbsoluteFill>
    );
};
