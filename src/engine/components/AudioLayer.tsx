import React, { useMemo } from 'react';
import { Audio, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface AudioLayerProps {
    audioUrl?: string;
    volume?: number; // 0 to 1
    startFrom?: number; // Seconds to start playing from
    children: React.ReactNode;
}

export const AudioLayer: React.FC<AudioLayerProps> = ({
    audioUrl,
    volume = 0.5,
    startFrom = 0,
    children
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames, fps } = useVideoConfig();

    // Calculate Turn-on/Turn-off Fading
    // Fade In: 0 -> Volume over 2 seconds (60 frames)
    // Fade Out: Volume -> 0 over last 2 seconds
    const fadeDuration = 2 * fps;

    const currentVolume = useMemo(() => {
        if (!audioUrl) return 0;

        const fadeIn = interpolate(
            frame,
            [0, fadeDuration],
            [0, volume],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        const fadeOut = interpolate(
            frame,
            [durationInFrames - fadeDuration, durationInFrames],
            [volume, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        // Apply the lowest of the two curves (Fade In at start, Fade Out at end)
        return Math.min(fadeIn, fadeOut);
    }, [frame, durationInFrames, fadeDuration, volume, audioUrl]);

    return (
        <>
            {children}
            {audioUrl && (
                <Audio
                    src={audioUrl}
                    volume={currentVolume}
                    startFrom={-(startFrom * fps)}
                    endAt={durationInFrames}
                />
            )}
        </>
    );
};
