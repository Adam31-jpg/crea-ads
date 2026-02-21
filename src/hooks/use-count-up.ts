import { useEffect, useState } from "react";

export function useCountUp(end: number, duration: number = 1500): number {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);

            // easeOutExpo for a fast start and slow finish
            const easeOutExpo = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);

            setCount(end * easeOutExpo);

            if (percentage < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setCount(end); // Ensure exact finish
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrameId);
    }, [end, duration]);

    return count;
}
