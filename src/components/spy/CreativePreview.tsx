"use client";

import { useState } from "react";
import { ExternalLink, ImageIcon, Eye } from "lucide-react";

interface CreativePreviewProps {
    sourceUrl?: string | null;
    sourceImageUrl?: string | null;
    sourcePlatform?: string | null;
    creativeName: string;
}

const PLATFORM_LABELS: Record<string, string> = {
    meta_ads: "Meta Ads",
    tiktok_ads: "TikTok Ads",
    google_ads: "Google Ads",
    instagram_organic: "Instagram",
    tiktok_organic: "TikTok",
    facebook_organic: "Facebook",
    youtube: "YouTube",
};

const AD_LIBRARY_HOSTS = [
    "facebook.com/ads/library",
    "library.tiktok.com/ads",
    "adstransparency.google.com",
    "youtube.com/results",
];

function isAdLibraryUrl(url: string): boolean {
    return AD_LIBRARY_HOSTS.some((h) => url.includes(h));
}

export function CreativePreview({ sourceUrl, sourceImageUrl, sourcePlatform, creativeName }: CreativePreviewProps) {
    const [imageError, setImageError] = useState(false);
    const platformLabel = sourcePlatform ? (PLATFORM_LABELS[sourcePlatform] ?? sourcePlatform) : "Source";
    const isLibraryLink = !!sourceUrl && isAdLibraryUrl(sourceUrl);
    const linkLabel = isLibraryLink ? `Voir les pubs ${platformLabel}` : "Voir la créative originale";

    if (sourceImageUrl && !imageError) {
        return (
            <div className="relative group rounded-lg overflow-hidden border border-border bg-muted/10 aspect-[4/5] max-h-[220px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={sourceImageUrl}
                    alt={creativeName}
                    className="w-full h-full object-cover"
                    onError={() => {
                        console.warn(`[CreativePreview] Image failed: ${sourceImageUrl}`);
                        setImageError(true);
                    }}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                />
                {sourceUrl && (
                    <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                        <span className="flex items-center gap-2 text-white text-xs font-medium bg-black/70 px-3 py-1.5 rounded-full">
                            <ExternalLink className="h-3 w-3" />
                            {linkLabel}
                        </span>
                    </a>
                )}
                <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/70 text-white/80 font-medium">
                    {platformLabel}
                </span>
            </div>
        );
    }

    if (sourceUrl) {
        return (
            <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-muted/5 hover:bg-muted/15 transition-colors aspect-[4/5] max-h-[220px] p-4 text-center group"
            >
                <Eye className="h-7 w-7 text-muted-foreground/40 group-hover:text-amber-500/60 transition-colors mb-2" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {linkLabel}
                </span>
                <span className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    {platformLabel}
                </span>
            </a>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/50 border-dashed bg-muted/5 aspect-[4/5] max-h-[220px] p-4 text-center">
            <ImageIcon className="h-7 w-7 text-muted-foreground/20 mb-2" />
            <span className="text-xs text-muted-foreground/40">Pas de preview</span>
        </div>
    );
}
