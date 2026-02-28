import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { GlassCard } from './GlassCard';

export const FeatureCard: React.FC<{
    features: string[];
    x: number;
    y: number;
    activeColor?: string;
}> = ({ features, x, y, activeColor = '#4ADE80' }) => {
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
                }}
            >
                <GlassCard padding="20px 24px" borderRadius={24}>
                    {features.map((label, idx) => {
                        const isActive = true; // All switches 'On' by default in the card
                        return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                {/* iOS Switch */}
                                <div
                                    style={{
                                        width: 51,
                                        height: 31,
                                        backgroundColor: isActive ? activeColor : 'rgba(255,255,255,0.15)',
                                        borderRadius: 16,
                                        position: 'relative',
                                        border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 27,
                                            height: 27,
                                            backgroundColor: '#ffffff',
                                            borderRadius: '50%',
                                            position: 'absolute',
                                            top: isActive ? 2 : 1,
                                            left: isActive ? 22 : 1,
                                            boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 3px 1px rgba(0,0,0,0.06)',
                                        }}
                                    />
                                </div>

                                {/* Text */}
                                <div
                                    style={{
                                        color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                                        fontFamily: 'Inter, sans-serif',
                                        fontSize: 20,
                                        fontWeight: 500,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                    }}
                                >
                                    {label}
                                </div>
                            </div>
                        );
                    })}
                </GlassCard>
            </div>
        </AbsoluteFill>
    );
};
