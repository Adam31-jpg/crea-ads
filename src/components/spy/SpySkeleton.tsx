"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export function CardSkeleton({ count = 1 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-lg border border-border bg-card p-4 animate-pulse"
                >
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-md bg-muted shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-3/4" />
                            <div className="h-3 bg-muted rounded w-1/2" />
                            <div className="h-3 bg-muted rounded w-2/3" />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <div className="h-5 bg-muted rounded-full w-16" />
                        <div className="h-5 bg-muted rounded-full w-20" />
                        <div className="h-5 bg-muted rounded-full w-14" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ProgressMessage({
    messages,
    intervalMs = 2500,
}: {
    messages: string[];
    intervalMs?: number;
}) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(
            () => setIndex((i) => (i + 1) % messages.length),
            intervalMs,
        );
        return () => clearInterval(timer);
    }, [messages, intervalMs]);

    return (
        <div className="flex items-center gap-3 text-muted-foreground text-sm py-1">
            <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
            <span className="transition-all duration-300">{messages[index]}</span>
        </div>
    );
}

export function IndeterminateBar() {
    return (
        <div className="h-0.5 w-full bg-border rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-amber-500 rounded-full animate-[slide_1.5s_ease-in-out_infinite]" />
        </div>
    );
}
