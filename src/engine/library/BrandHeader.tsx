import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

export const BrandHeader: React.FC<{
    brandName: string;
    x?: number;
    y?: number;
}> = ({ brandName, x = 50, y = 10 }) => {
    const { width, height } = useVideoConfig();

    const left = (x / 100) * width;
    const top = (y / 100) * height;

    return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <div
                style={{
                    position: 'absolute',
                    left,
                    top,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 4,
                }}
            >
                {/* Minimalist 1px SVG Line */}
                <div style={{ width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.5)', marginBottom: 2 }} />

                <h1
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 300,
                        fontSize: 22,
                        letterSpacing: '0.25em',
                        color: '#FFFFFF',
                        textTransform: 'uppercase',
                        margin: 0,
                        textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    }}
                >
                    {brandName}
                </h1>

                <div style={{ width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.5)', marginTop: 2 }} />
            </div>
        </AbsoluteFill>
    );
};
