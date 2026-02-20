import { useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * useBeat Hook
 * Returns a normalized pulse value (0 to 1) synchronized with the BPM.
 * 
 * @param bpm Beats Per Minute of the track
 * @param offset Optional offset in seconds
 * @returns 
 *   beat: The current beat index (float)
 *   pulse: A 0-1 sawtooth wave resetting every beat
 *   kick: A short, sharp impulse at the start of every beat (useful for scaling)
 */
export const useBeat = (bpm: number, offset: number = 0) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const framesPerBeat = (60 / bpm) * fps;
    const offsetFrames = offset * fps;

    const currentFrameWithOffset = Math.max(0, frame - offsetFrames);

    // Continuous beat count (e.g., 1.5 = halfway through 2nd beat)
    const beat = currentFrameWithOffset / framesPerBeat;

    // Sawtooth wave 0 -> 1 for every beat
    const pulse = beat % 1;

    // Sharp kick: 1 at start of beat, rapidly decaying to 0
    // Function: e^(-10 * pulse)
    const kick = Math.pow(Math.E, -10 * pulse);

    return { beat, pulse, kick };
};
