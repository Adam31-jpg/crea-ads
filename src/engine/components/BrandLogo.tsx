import React from "react";
import { Img } from "remotion";

type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | null | undefined;

interface BrandLogoProps {
    src?: string | null;
    position?: LogoPosition;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ src, position }) => {
    if (!src || !position) return null;

    // All sizing and positioning values are CSS percentages, relative to
    // the SafeZone container.  Because SafeZone now derives its dimensions
    // from SAFE_AREA_FRACTIONS × actual render resolution, these % values
    // scale correctly at 720p, 1080p, 4K, or any other resolution without
    // any changes here.
    const style: React.CSSProperties = {
        position: "absolute",
        maxWidth: "15%",   // max 15% of SafeZone width
        maxHeight: "15%",  // max 15% of SafeZone height
        objectFit: "contain",
        filter: "drop-shadow(0px 4px 10px rgba(0,0,0,0.5))",
        zIndex: 50,
    };

    // 5% inset from each SafeZone edge — resolution-independent by inheritance.
    switch (position) {
        case "top-left":
            style.top = "5%";
            style.left = "5%";
            break;
        case "top-right":
            style.top = "5%";
            style.right = "5%";
            break;
        case "bottom-left":
            style.bottom = "5%";
            style.left = "5%";
            break;
        case "bottom-right":
            style.bottom = "5%";
            style.right = "5%";
            break;
        default:
            return null; // Should not hit if typed correctly, but safety fallback.
    }

    // Epic 9: Chromium Taint Cache Buster
    const cacheBustedSrc = src.includes('?') ? `${src}&v=${Date.now()}` : `${src}?v=${Date.now()}`;

    return <Img crossOrigin="anonymous" src={cacheBustedSrc} style={style} />;
};
