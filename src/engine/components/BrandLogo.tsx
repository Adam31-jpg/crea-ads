import React from "react";
import { Img } from "remotion";

type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | null | undefined;

interface BrandLogoProps {
    src?: string | null;
    position?: LogoPosition;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ src, position }) => {
    if (!src || !position) return null;

    // Intelligent Scaling constraints (Max 15%) & Safe Zone (5%)
    const style: React.CSSProperties = {
        position: "absolute",
        maxWidth: "15%",
        maxHeight: "15%",
        objectFit: "contain",
        filter: "drop-shadow(0px 4px 10px rgba(0,0,0,0.5))",
        zIndex: 50, // ensures it floats above product/hero objects
    };

    // Apply exact positioning logic with a 5% safe zone margin
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

    return <Img src={src} style={style} />;
};
