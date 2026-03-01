import React from 'react';

interface GlassContainerProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    padding?: string | number;
    borderRadius?: number;
    intensity?: 'light' | 'medium' | 'heavy';
}

/**
 * The unified standard for all premium UI overlays in Lumina.
 * Enforces the 12px blur, 1px soft border, and consistent translucent shadows.
 */
export const GlassContainer: React.FC<GlassContainerProps> = ({
    children,
    style = {},
    padding = '10px 20px',
    borderRadius = 8,
    intensity = 'medium',
}) => {
    // Determine background opacity based on intensity
    let bgOpacity = 0.35;
    if (intensity === 'light') bgOpacity = 0.15;
    if (intensity === 'heavy') bgOpacity = 0.6;

    return (
        <div
            style={{
                padding,
                backgroundColor: `rgba(20, 20, 20, ${bgOpacity})`,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                borderRadius,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...style,
            }}
        >
            {children}
        </div>
    );
};
