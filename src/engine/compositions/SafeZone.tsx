import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

interface SafeZoneProps {
    aspectRatio: '1:1' | '9:16' | '16:9' | '4:5';
    children?: React.ReactNode;
    debug?: boolean;
}

/**
 * SAFE_AREA_FRACTIONS — resolution-independent safe margins.
 *
 * Every value is a fraction (0–1) derived from the canonical pixel values at
 * each format's standard resolution.  At runtime they are multiplied by the
 * actual `width` / `height` from useVideoConfig(), so the insets scale
 * correctly at any render resolution (720p, 1080p, 4K, etc.).
 *
 * Derivation table (canonical res → fraction):
 *
 * ┌────────┬───────────────┬────────────────────────────────────────────┐
 * │ Format │ Canonical res │ Margin origins                             │
 * ├────────┼───────────────┼────────────────────────────────────────────┤
 * │  9:16  │ 1080 × 1920   │ top  220 / 1920 = 11.46% (TikTok top UI)  │
 * │        │               │ btm  400 / 1920 = 20.83% (caption/homebar)│
 * │        │               │ lft   60 / 1080 =  5.56% (>5% min)        │
 * │        │               │ rgt  140 / 1080 = 12.96% (like/share btns)│
 * ├────────┼───────────────┼────────────────────────────────────────────┤
 * │  1:1   │ 1080 × 1080   │ all sides: 60 / 1080 = 5.56%              │
 * ├────────┼───────────────┼────────────────────────────────────────────┤
 * │ 16:9   │ 1920 × 1080   │ top/btm  60 / 1080 = 5.56%                │
 * │        │               │ lft/rgt 100 / 1920 = 5.21% (YT overlays)  │
 * ├────────┼───────────────┼────────────────────────────────────────────┤
 * │  4:5   │ 1080 × 1350   │ top/btm  70 / 1350 = 5.19%                │
 * │        │               │ lft/rgt  60 / 1080 = 5.56%                │
 * └────────┴───────────────┴────────────────────────────────────────────┘
 *
 * top / bottom fractions are applied to `height`.
 * left / right  fractions are applied to `width`.
 */
const SAFE_AREA_FRACTIONS: Record<
    '9:16' | '1:1' | '16:9' | '4:5',
    { top: number; bottom: number; left: number; right: number }
> = {
    '9:16': { top: 0.1146, bottom: 0.2083, left: 0.0556, right: 0.1296 },
    '1:1':  { top: 0.0556, bottom: 0.0556, left: 0.0556, right: 0.0556 },
    '16:9': { top: 0.0556, bottom: 0.0556, left: 0.0521, right: 0.0521 },
    '4:5':  { top: 0.0519, bottom: 0.0519, left: 0.0556, right: 0.0556 },
};

export const SafeZone: React.FC<SafeZoneProps> = ({ aspectRatio, children, debug = false }) => {
    const { width, height } = useVideoConfig();

    const frac = SAFE_AREA_FRACTIONS[aspectRatio] ?? SAFE_AREA_FRACTIONS['1:1'];

    // Derive actual pixel values for this render resolution.
    // Math.round keeps values on pixel boundaries to avoid sub-pixel blurring.
    const safe = {
        top:    Math.round(height * frac.top),
        bottom: Math.round(height * frac.bottom),
        left:   Math.round(width  * frac.left),
        right:  Math.round(width  * frac.right),
    };

    return (
        <AbsoluteFill>
            {/* Content Layer — constrained to the safe rectangle */}
            <div
                style={{
                    position: 'absolute',
                    top:    safe.top,
                    left:   safe.left,
                    right:  safe.right,
                    bottom: safe.bottom,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    pointerEvents: 'none',
                }}
            >
                {children}
            </div>

            {/* Debug Overlay — set debug={true} to visualise danger zones in Remotion Studio */}
            {debug && (
                <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 9999 }}>
                    {/* Danger zone highlights */}
                    <div style={{ position: 'absolute', top: 0,          left: 0, right: 0,          height: safe.top,    background: 'rgba(255,0,0,0.3)' }} />
                    <div style={{ position: 'absolute', bottom: 0,       left: 0, right: 0,          height: safe.bottom, background: 'rgba(255,0,0,0.3)' }} />
                    <div style={{ position: 'absolute', top: safe.top,   left: 0, bottom: safe.bottom, width: safe.left,  background: 'rgba(255,0,0,0.3)' }} />
                    <div style={{ position: 'absolute', top: safe.top,   right: 0, bottom: safe.bottom, width: safe.right, background: 'rgba(255,0,0,0.3)' }} />

                    {/* Safe area bounding box with resolution readout */}
                    <div style={{
                        position: 'absolute',
                        top:    safe.top,
                        left:   safe.left,
                        width:  width  - safe.left - safe.right,
                        height: height - safe.top  - safe.bottom,
                        border: '2px solid #00FF00',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        color: '#00FF00',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: Math.round(width * 0.022), // ~24px at 1080px wide
                        textShadow: '0 0 5px black',
                    }}>
                        <span>SAFE AREA</span>
                        <span style={{ fontSize: Math.round(width * 0.014), fontWeight: 'normal', opacity: 0.8 }}>
                            {width - safe.left - safe.right} × {height - safe.top - safe.bottom}px
                            &nbsp;({aspectRatio} @ {width}×{height})
                        </span>
                    </div>
                </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};
