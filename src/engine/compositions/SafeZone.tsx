import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

interface SafeZoneProps {
    aspectRatio: '1:1' | '9:16' | '16:9' | '4:5';
    children?: React.ReactNode;
    debug?: boolean;
}

// Danger Zones for 9:16 (TikTok/Reels)
// These are typical pixel values for 1080x1920
const SAFE_AREAS = {
    '9:16': {
        top: 220, // UI Top Elements
        bottom: 400, // Captions/Audio/Home Bar
        left: 60, // Increased to >5% (54px)
        right: 140, // Like/Share buttons
    },
    '1:1': {
        top: 60,
        bottom: 60,
        left: 60,
        right: 60,
    },
    '16:9': {
        top: 60,
        bottom: 60,
        left: 100, // YouTube Overlay?
        right: 100,
    },
    '4:5': {
        top: 70,
        bottom: 70,
        left: 60,
        right: 60,
    }
};

export const SafeZone: React.FC<SafeZoneProps> = ({ aspectRatio, children, debug = false }) => {
    const { width, height } = useVideoConfig();

    const safe = SAFE_AREAS[aspectRatio] || SAFE_AREAS['1:1'];

    // Always constrain content, regardless of debug mode
    return (
        <AbsoluteFill>
            {/* Content Layer - Constrained */}
            <div
                style={{
                    position: 'absolute',
                    top: safe.top,
                    left: safe.left,
                    right: safe.right,
                    bottom: safe.bottom,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    // border: debug ? '2px dashed #00FF00' : 'none', // Visualization of constraints
                    pointerEvents: 'none', // Let clicks pass through
                }}
            >
                {children}
            </div>

            {/* Debug Overlay */}
            {debug && (
                <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 9999 }}>
                    {/* Danger Zones Highlight */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safe.top, background: 'rgba(255, 0, 0, 0.3)' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: safe.bottom, background: 'rgba(255, 0, 0, 0.3)' }} />
                    <div style={{ position: 'absolute', top: safe.top, bottom: safe.bottom, left: 0, width: safe.left, background: 'rgba(255, 0, 0, 0.3)' }} />
                    <div style={{ position: 'absolute', top: safe.top, bottom: safe.bottom, right: 0, width: safe.right, background: 'rgba(255, 0, 0, 0.3)' }} />

                    <div style={{
                        position: 'absolute',
                        top: safe.top,
                        left: safe.left,
                        width: width - safe.left - safe.right,
                        height: height - safe.top - safe.bottom,
                        border: '2px solid #00FF00',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#00FF00',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: 24,
                        textShadow: '0 0 5px black'
                    }}>
                        SAFE AREA
                    </div>
                </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};
