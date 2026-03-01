import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { GlassContainer } from './GlassContainer';

export const FeatureSwitch: React.FC<{
    label: string;
    x?: number;
    y?: number;
    isActive?: boolean;
    activeColor?: string;
    isRelative?: boolean;
}> = ({ label, x = 0, y = 0, isActive = true, activeColor = '#4ADE80', isRelative = false }) => {
    const { width, height } = useVideoConfig();

    const left = (x / 100) * width;
    const top = (y / 100) * height;

    const content = (
        <GlassContainer
            intensity="medium"
            padding="12px 24px"
            borderRadius={32}
            style={{
                position: isRelative ? 'relative' : 'absolute',
                left: isRelative ? undefined : left,
                top: isRelative ? undefined : top,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                gap: 16,
            }}
        >
            {/* The Text (Pinned Left) */}
            <div
                style={{
                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    textAlign: 'left'
                }}
            >
                {label}
            </div>

            {/* The "Switch" (Pinned Right) */}
            <div
                style={{
                    width: 51,
                    height: 31,
                    backgroundColor: isActive ? activeColor : 'rgba(255,255,255,0.15)',
                    borderRadius: 16,
                    position: 'relative',
                    transition: 'background-color 0.3s ease',
                    border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        width: 27,
                        height: 27,
                        backgroundColor: '#ffffff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: isActive ? 2 : 1, // Slight 1px offset when border is present
                        left: isActive ? 22 : 1,
                        boxShadow: '0 3px 8px rgba(0,0,0,0.15), 0 3px 1px rgba(0,0,0,0.06)',
                        transition: 'left 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
                    }}
                />
            </div>
        </GlassContainer>
    );

    if (isRelative) return content;

    return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
            {content}
        </AbsoluteFill>
    );
};
