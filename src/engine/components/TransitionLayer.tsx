import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, Easing } from 'remotion';
import { z } from 'zod';
import { RemotionPropsSchema } from '../schema/project';

type TransitionProps = z.infer<typeof RemotionPropsSchema>['transition'];

interface TransitionLayerProps {
    transition?: TransitionProps;
    children: React.ReactNode;
}

export const TransitionLayer: React.FC<TransitionLayerProps> = ({ transition, children }) => {
    const frame = useCurrentFrame();
    const { durationInFrames, fps, width, height } = useVideoConfig();

    if (!transition || transition.style === 'none') {
        return <AbsoluteFill>{children}</AbsoluteFill>;
    }

    const durationFrames = transition.duration * fps;

    // Intro Progress: 0 -> 1 over duration
    const introProgress = interpolate(
        frame,
        [0, durationFrames],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) }
    );

    // Outro Progress: 0 -> 1 over last duration
    const outroProgress = interpolate(
        frame,
        [durationInFrames - durationFrames, durationInFrames],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.ease) }
    );

    // --- Styles ---

    // 1. Blur Dissolve
    // Intro: Blur 20px -> 0px
    // Outro: Blur 0px -> 20px
    const blurAmount = transition.style === 'blur'
        ? (1 - introProgress) * 20 + (outroProgress * 20)
        : 0;

    const blurStyle: React.CSSProperties = transition.style === 'blur' ? {
        filter: `blur(${blurAmount}px)`,
        transform: `scale(${1 + (blurAmount / 100)})`, // Slight scale to hide blurred edges
    } : {};


    // 2. Luxury Wipe (Angled Panels)
    // Intro: Panels slide OUT to reveal content
    // Outro: Panels slide IN to hide content
    const renderWipe = () => {
        if (transition.style !== 'wipe') return null;

        // Intro: 0 means panel is fully covering, 1 means panel is gone.
        // We want panels to start covering (frame 0) and move away.
        // Slide Distance: Width of screen + extra for angle
        const slideDist = width * 1.5;

        // Left Panel (slides left)
        const leftX = interpolate(introProgress, [0, 1], [0, -slideDist]);
        // Right Panel (slides right)
        const rightX = interpolate(introProgress, [0, 1], [0, slideDist]);

        // Outro Logic Override?
        // If outro is happening (outroProgress > 0), panels slide back IN.
        // Left logic: -slideDist -> 0
        const outroLeftX = interpolate(outroProgress, [0, 1], [-slideDist, 0]);
        const outroRightX = interpolate(outroProgress, [0, 1], [slideDist, 0]);

        // Combine: if intro is done, use outro position. 
        // Simplification: Just max/min them? 
        // Better: Calculate offset based on active phase.

        const currentLeftX = outroProgress > 0 ? outroLeftX : leftX;
        const currentRightX = outroProgress > 0 ? outroRightX : rightX;

        const panelStyle: React.CSSProperties = {
            position: 'absolute',
            top: -height * 0.5, // Oversize to cover rotation
            bottom: -height * 0.5,
            width: width,
            backgroundColor: '#000',
            zIndex: 1000,
            transform: 'skewX(-20deg)', // Angled wipe
        };

        return (
            <>
                <div style={{ ...panelStyle, left: -width * 0.2, transform: `translateX(${currentLeftX}px) skewX(-20deg)` }} />
                <div style={{ ...panelStyle, right: -width * 0.2, transform: `translateX(${currentRightX}px) skewX(-20deg)` }} />
            </>
        );
    };

    return (
        <AbsoluteFill>
            <div style={{ width: '100%', height: '100%', ...blurStyle }}>
                {children}
            </div>
            {renderWipe()}
        </AbsoluteFill>
    );
};
