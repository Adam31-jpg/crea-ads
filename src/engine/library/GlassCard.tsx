import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    padding?: string | number;
    borderRadius?: number;
}

/**
 * GlassCard: A heavy glassmorphism container specifically designed to group
 * multiple USPs or UI elements like FeatureSwitches. 
 * Enforces a darker, more blurred background (16px blur) for high contrast.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    style = {},
    padding = '24px',
    borderRadius = 24,
}) => {
    return (
        <div
            style={{
                ...style,
                padding,
                backgroundColor: 'rgba(255, 255, 255, 0.45)', // Loly pink is bright, use light glass
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255,255,255,0.2)',
                borderRadius: borderRadius === 24 ? 32 : borderRadius,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            }}
        >
            {children}
        </div>
    );
};
