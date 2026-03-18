// Shared theme definitions — extracted from the legacy studio page
// so that DuplicateBatchModal and other components can import them
// without depending on the dormant studio page route.

export const THEMES = [
    { id: "luxe-sombre", image: "/images/themes/luxe-sombre.jpg", text: "text-zinc-200", palette: { primary: "#D4AF37", secondary: "#1A1A1A", tertiary: "#4A4A4A" } },
    { id: "studio-white", image: "/images/themes/studio-white.jpg", text: "text-zinc-800", palette: { primary: "#000000", secondary: "#F5F5F5", tertiary: "#E0E0E0" } },
    { id: "neon", image: "/images/themes/neon.jpg", text: "text-zinc-100", palette: { primary: "#FF00FF", secondary: "#00FFFF", tertiary: "#09090B" } },
    { id: "nature", image: "/images/themes/nature.jpg", text: "text-zinc-900", palette: { primary: "#2E8B57", secondary: "#F5DEB3", tertiary: "#8FBC8F" } },
    { id: "pop", image: "/images/themes/pop.jpg", text: "text-zinc-800", palette: { primary: "#FF4500", secondary: "#FFD700", tertiary: "#1E90FF" } },
    { id: "sunset", image: "/images/themes/sunset.jpg", text: "text-zinc-100", palette: { primary: "#FF7F50", secondary: "#8A2BE2", tertiary: "#FFDAB9" } },
];

export const ThemePreviewSVG = () => (
    <svg viewBox="0 0 100 100" className="w-full h-full opacity-80" preserveAspectRatio="xMidYMid meet">
        <rect x="10" y="10" width="80" height="40" rx="4" fill="currentColor" fillOpacity="0.1" />
        <rect x="10" y="55" width="60" height="6" rx="3" fill="currentColor" fillOpacity="0.8" />
        <rect x="10" y="65" width="40" height="4" rx="2" fill="currentColor" fillOpacity="0.4" />
        <rect x="10" y="75" width="35" height="12" rx="2" fill="var(--accent-color)" />
        <rect x="15" y="80" width="25" height="2" rx="1" fill="#ffffff" fillOpacity="0.8" />
    </svg>
);
