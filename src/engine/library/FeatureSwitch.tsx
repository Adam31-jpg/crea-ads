import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

export const FeatureSwitch: React.FC<{
    label: string;
    x: number;
    y: number;
    isActive?: boolean;
    activeColor?: string;
}> = ({ label, x, y, isActive = true, activeColor = '#4ADE80' }) => {
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '12px 24px',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 32,
                }}
            >
                {/* The "Switch" */}
                <div
                    style={{
                        width: 48,
                        height: 24,
                        backgroundColor: isActive ? activeColor : 'rgba(255,255,255,0.2)',
                        borderRadius: 12,
                        position: 'relative',
                        transition: 'background-color 0.3s ease',
                    }}
                >
                    <div
                        style={{
                            width: 20,
                            height: 20,
                            backgroundColor: '#ffffff',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: 2,
                            left: isActive ? 26 : 2,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            transition: 'left 0.3s ease',
                        }}
                    />
                </div>

                {/* The Text */}
                <div
                    style={{
                        color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 26,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}
                >
                    {label}
                </div>
            </div>
        </AbsoluteFill>
    );
};
