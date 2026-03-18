"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdPreviewCardProps {
    competitorName: string;
    platform: "meta" | "tiktok";
    adLibraryUrl: string;
    className?: string;
}

const META_ICON = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 7.5c0-1.38-1.12-2.5-2.5-2.5-.92 0-1.72.5-2.14 1.24A2.49 2.49 0 009.5 7C8.12 7 7 8.12 7 9.5c0 .97.55 1.8 1.36 2.22-.05.26-.08.53-.08.78C8.28 14.5 10 16 12 16s3.72-1.5 3.72-3.5c0-.25-.03-.52-.08-.78.81-.42 1.36-1.25 1.36-2.22z" />
    </svg>
);

const TIKTOK_ICON = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.79a8.18 8.18 0 004.78 1.52V6.86a4.85 4.85 0 01-1.01-.17z" />
    </svg>
);

export function AdPreviewCard({ competitorName, platform, adLibraryUrl, className }: AdPreviewCardProps) {
    const isMeta = platform === "meta";

    return (
        <a
            href={adLibraryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-muted/30 hover:bg-muted/60 hover:border-border/80 transition-colors group text-sm",
                className,
            )}
        >
            <span className={cn("shrink-0", isMeta ? "text-blue-400" : "text-foreground")}>
                {isMeta ? <META_ICON /> : <TIKTOK_ICON />}
            </span>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors truncate">
                {isMeta ? "Meta" : "TikTok"} — {competitorName}
            </span>
            <ExternalLink className="h-3 w-3 ml-auto shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
        </a>
    );
}
