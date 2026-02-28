import React from 'react';
import type { LayoutConfig } from '../schema/project';

interface ScrimLayerProps {
    layout_config: LayoutConfig;
    /** Optional override opacity for the scrim (0–1). Default: 0.45 */
    opacity?: number;
}

// ─── Negative Space Zone → CSS Gradient Map ───────────────────────────────────
// Each zone produces a gradient that darkens the canvas in that region,
// ensuring text placed there pops against any AI-generated background.
// Gradients are semi-transparent so the scene still shows through.

type Zone = LayoutConfig['negative_space_zone'];

function buildScrimGradient(zone: Zone, opacity: number): string {
    const dark = `rgba(0,0,0,${opacity})`;
    const clear = 'rgba(0,0,0,0)';

    switch (zone) {
        case 'top-left':
            return `radial-gradient(ellipse 70% 60% at 15% 20%, ${dark} 0%, ${clear} 100%)`;
        case 'top-right':
            return `radial-gradient(ellipse 70% 60% at 85% 20%, ${dark} 0%, ${clear} 100%)`;
        case 'bottom-left':
            return `radial-gradient(ellipse 70% 60% at 15% 80%, ${dark} 0%, ${clear} 100%)`;
        case 'bottom-right':
            return `radial-gradient(ellipse 70% 60% at 85% 80%, ${dark} 0%, ${clear} 100%)`;
        case 'top':
            return `linear-gradient(to bottom, ${dark} 0%, ${clear} 45%)`;
        case 'bottom':
            return `linear-gradient(to top, ${dark} 0%, ${clear} 45%)`;
        case 'left':
            return `linear-gradient(to right, ${dark} 0%, ${clear} 45%)`;
        case 'right':
            return `linear-gradient(to left, ${dark} 0%, ${clear} 45%)`;
        case 'center':
            return `radial-gradient(ellipse 55% 45% at 50% 50%, ${dark} 0%, ${clear} 100%)`;
        default:
            return 'none';
    }
}

/**
 * ScrimLayer — Text Protection Gradient
 *
 * Places a directional CSS gradient over the AI-generated background image
 * in the same region specified by `layout_config.negative_space_zone`.
 * This ensures Remotion text overlays are legible regardless of how bright
 * or busy the AI-generated background turns out.
 *
 * The gradient is a soft radial/linear shadow — dark at the centre of the zone,
 * fully transparent at the edges — so the product and scene still read clearly.
 */
export const ScrimLayer: React.FC<ScrimLayerProps> = ({
    layout_config,
    opacity = 0.45,
}) => {
    const gradient = buildScrimGradient(layout_config.negative_space_zone, opacity);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: gradient,
                zIndex: 15,           // Above background image, below text layers
                pointerEvents: 'none',
            }}
        />
    );
};
