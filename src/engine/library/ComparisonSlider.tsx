import React from 'react';
import { AbsoluteFill } from 'remotion';

export const ComparisonSlider: React.FC<{
    x: number;
    y: number;
    beforeText?: string;
    afterText?: string;
}> = ({ x, y, beforeText = "BEFORE", afterText = "AFTER" }) => {
    return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
            <div
                style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                    transform: 'translate(-50%, -50%)',
                }}
            >
                <div style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 20,
                    fontFamily: 'Inter, sans-serif',
                    letterSpacing: '0.1em',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                }}>
                    {beforeText}
                </div>

                {/* The Slider Track & Handle */}
                <div style={{ position: 'relative', width: 120, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 }}>
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: -8,
                        transform: 'translateX(-50%)',
                        width: 20,
                        height: 20,
                        backgroundColor: '#ffffff',
                        borderRadius: '50%',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        border: '2px solid rgba(0,0,0,0.1)'
                    }} />
                </div>

                <div style={{
                    color: '#ffffff',
                    fontSize: 20,
                    fontFamily: 'Inter, sans-serif',
                    letterSpacing: '0.1em',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                }}>
                    {afterText}
                </div>
            </div>
        </AbsoluteFill>
    );
};
