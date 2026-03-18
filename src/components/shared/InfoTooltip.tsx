"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

interface InfoTooltipProps {
    title: string;
    content: string;
    storageKey: string;
}

export function InfoTooltip({ title, content, storageKey }: InfoTooltipProps) {
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(storageKey) === "dismissed";
    });

    if (dismissed) return null;

    return (
        <div className="relative rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 pr-8 text-sm">
            <button
                onClick={() => {
                    setDismissed(true);
                    localStorage.setItem(storageKey, "dismissed");
                }}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
            >
                <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex gap-2">
                <HelpCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium text-xs text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{content}</p>
                </div>
            </div>
        </div>
    );
}
