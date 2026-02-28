import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

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
            {/* The Dot */}
            <div
                style={{
                    position: 'absolute',
                    left: left - 8, // Center dot
                    top: top - 8,
                    width: 16,
                    height: 16,
                    backgroundColor: dotColor,
                    borderRadius: '50%',
                    boxShadow: `0 0 10px ${dotColor}`,
                }}
            />

            {/* The Connecting Line (simulated as a simple line to the right) */}
            <div
                style={{
                    position: 'absolute',
                    left: left + 16,
                    top: top - 1,
                    width: 40,
                    height: 2,
                    backgroundColor: dotColor,
                    opacity: 0.8,
                }}
            />

            {/* The Text Box */}
            <div
                style={{
                    position: 'absolute',
                    left: left + 66,
                    top: top - 20, // Center text vertically with dot
                    padding: '8px 16px',
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(8px)',
                    border: `1px solid rgba(255, 255, 255, 0.2)`,
                    borderRadius: 8,
                    color: '#ffffff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 24,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
            >
                {label}
            </div>
        </AbsoluteFill>
    );
};
