"use client";

import React, { useState } from "react";
import { Player } from "@remotion/player";
import { MasterComposition } from "@/engine/compositions/MasterComposition";
import { RemotionProps } from "@/engine/schema/project";
import { LayoutTemplate, MonitorPlay, Image as ImageIcon, Smartphone, Square, Monitor, Upload, Loader2 } from "lucide-react";

const TEMPLATES = [
    "AD_LUXE_LOLY",
    "AD_OVERHEAD_MINIMAL",
    "AD_MINIMAL_PRO",
    "AD_CIRCLE_CENTER",
    "AD_NEON_POP",
    "AD_ORGANIC_GLOW"
];

const getMockProps = (template_id: string, aspectRatio: "9:16" | "1:1" | "16:9"): RemotionProps => {
    if (template_id === "AD_OVERHEAD_MINIMAL") {
        return {
            template_id,
            isSandboxMock: true,
            backgroundImageUrl: "/sandbox_image.webp", // Default local test background
            productImageUrl: "",
            productImageUrls: [],
            logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/1200px-Logo_NIKE.svg.png", // Fake minimalist logo
            colors: {
                primary: "#FFFFFF",
                secondary: "#1A1A1A",
                accent: "#E2E8F0",
                background: "#000000",
                textPrimary: "#FFFFFF",
            },
            fontFamily: "Inter",
            headlineText: "PURE MINIMAL",
            layout: {
                layoutType: "minimalist",
                aspectRatio,
                safePadding: 32,
                contentScale: 1,
            },
            camera: {
                zoomStart: 1,
                zoomEnd: 1,
                orbitSpeed: 0,
                panX: 0,
            },
            glassmorphism: { enabled: false, intensity: 0.5, blur: 10 },
            enableMotionBlur: false,
            hideHeroObject: true,
            compositionIntent: "cinematic",
            component_layout: [],
            elements: [],
        };
    } else if (template_id === "AD_CIRCLE_CENTER") {
        return {
            template_id,
            isSandboxMock: true,
            backgroundImageUrl: "/sandbox_image.webp", // Default local test background
            productImageUrl: "",
            productImageUrls: [],
            logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/1200px-Logo_NIKE.svg.png",
            websiteUrl: "lumina.com",
            phoneNumber: "0800 123 456",
            colors: {
                primary: "#E11D48",    // Vibrant rose red background for the chip
                secondary: "#1A1A1A",
                accent: "#FBBF24",     // Yellow for subheadline text
                background: "#000000",
                textPrimary: "#FFFFFF",
            },
            fontFamily: "Outfit",
            headlineText: "PERFECT MATCH",
            subheadlineText: "GEOMETRIC BEAUTY",
            layout: {
                layoutType: "minimalist",
                aspectRatio,
                safePadding: 32,
                contentScale: 1,
            },
            camera: { zoomStart: 1, zoomEnd: 1, orbitSpeed: 0, panX: 0 },
            glassmorphism: { enabled: false, intensity: 0, blur: 0 },
            enableMotionBlur: false,
            hideHeroObject: true,
            compositionIntent: "cinematic",
            component_layout: [],
            elements: [],
        };
    }

    return {
        template_id,
        isSandboxMock: true,
        backgroundImageUrl: "/sandbox_image.webp", // Default local test background
        productImageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=3000&auto=format&fit=crop",
        productImageUrls: [],
        colors: {
            primary: "#C8A2C8",
            secondary: "#3A004C",
            accent: "#F5F5DC",
            background: "#1A0024",
            textPrimary: "#FFFFFF",
        },
        fontFamily: "Bodoni",
        headlineText: "RITUEL DE MINUIT",
        layout: {
            layoutType: "converter",
            aspectRatio,
            safePadding: 32,
            contentScale: 1,
        },
        camera: {
            zoomStart: 1,
            zoomEnd: 1,
            orbitSpeed: 0,
            panX: 0,
        },
        glassmorphism: { enabled: false, intensity: 0.5, blur: 10 },
        enableMotionBlur: false,
        hideHeroObject: false,
        compositionIntent: "cinematic",
        component_layout: [
            {
                component: "BrandHeader",
                props: { brandName: "LES SECRETS DE LOLY" },
            },
            {
                component: "FeatureCard",
                props: { features: ["FREINE LA CHUTE", "BOOSTE LA CROISSANCE", "RENFORCE LA FIBRE"] },
            },
        ],
        elements: [],
    };
};

export default function SandboxPage() {
    const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "16:9">("9:16");
    const [templateId, setTemplateId] = useState<string>("AD_LUXE_LOLY");
    const [mediaMode, setMediaMode] = useState<"video" | "image">("image");
    const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const presignRes = await fetch("/api/sandbox/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, contentType: file.type }),
            });
            if (!presignRes.ok) throw new Error("Failed to get presigned URL");

            const { presignedUrl, publicUrl } = await presignRes.json();
            const uploadRes = await fetch(presignedUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
            });
            if (!uploadRes.ok) throw new Error("S3 Upload Failed");

            setCustomBgUrl(publicUrl);
        } catch (err) {
            console.error("Upload Error:", err);
            alert("Failed to upload custom background.");
        } finally {
            setIsUploading(false);
        }
    };

    let width = 1080;
    let height = 1920;
    if (aspectRatio === "1:1") { width = 1080; height = 1080; }
    else if (aspectRatio === "16:9") { width = 1920; height = 1080; }

    const isImage = mediaMode === "image";
    const FPS = isImage ? 1 : 30;
    const DURATION_IN_FRAMES = isImage ? 1 : 150;

    const mockProps = getMockProps(templateId, aspectRatio);
    if (customBgUrl) {
        mockProps.backgroundImageUrl = customBgUrl;
    }

    return (
        <div className="flex h-full text-white">
            {/* Local Sandbox Settings Sidebar */}
            <div className="w-80 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col gap-8 overflow-y-auto">
                <div>
                    <h2 className="text-xl font-bold tracking-tight mb-1">Sandbox V2</h2>
                    <p className="text-sm text-zinc-500">Live AI Template Debugger</p>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <LayoutTemplate className="w-4 h-4" /> Available Templates
                    </label>
                    <div className="flex flex-col gap-2">
                        {TEMPLATES.map(t => (
                            <button
                                key={t}
                                onClick={() => setTemplateId(t)}
                                className={`px-4 py-3 rounded-md text-left text-sm transition-colors border ${templateId === t
                                    ? "bg-zinc-800 border-zinc-700 text-white font-medium shadow-inner"
                                    : "bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900"
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <MonitorPlay className="w-4 h-4" /> Render Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded-lg">
                        <button
                            onClick={() => setMediaMode("image")}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm transition-all ${isImage ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-white"
                                }`}
                        >
                            <ImageIcon className="w-4 h-4" /> Image
                        </button>
                        <button
                            onClick={() => setMediaMode("video")}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm transition-all ${!isImage ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-white"
                                }`}
                        >
                            <MonitorPlay className="w-4 h-4" /> Video
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Monitor className="w-4 h-4" /> Aspect Ratio Target
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setAspectRatio("9:16")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${aspectRatio === "9:16" ? "bg-zinc-800 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                }`}
                        >
                            <Smartphone className="w-6 h-6" />
                            <span className="text-xs">9:16</span>
                        </button>
                        <button
                            onClick={() => setAspectRatio("1:1")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${aspectRatio === "1:1" ? "bg-zinc-800 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                }`}
                        >
                            <Square className="w-6 h-6" />
                            <span className="text-xs">1:1</span>
                        </button>
                        <button
                            onClick={() => setAspectRatio("16:9")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${aspectRatio === "16:9" ? "bg-zinc-800 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                }`}
                        >
                            <Monitor className="w-6 h-6" />
                            <span className="text-xs">16:9</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Custom Background
                    </label>
                    <div className="relative">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleUpload}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                        />
                        <button
                            disabled={isUploading}
                            className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${isUploading ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'}`}
                        >
                            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            <span className="text-sm">{isUploading ? 'Uploading...' : 'Upload Image'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 bg-black p-8 flex flex-col justify-center items-center relative overflow-hidden bg-[url('/noise.png')]">
                <div className="relative shadow-2xl overflow-hidden border border-white/10"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '85vh',
                        aspectRatio: aspectRatio === "16:9" ? '16/9' : aspectRatio === "1:1" ? '1/1' : '9/16',
                        height: aspectRatio === "9:16" ? '85vh' : 'auto',
                        width: aspectRatio !== "9:16" ? '100%' : 'auto'
                    }}>
                    <Player
                        component={MasterComposition}
                        inputProps={mockProps}
                        durationInFrames={DURATION_IN_FRAMES}
                        fps={FPS}
                        compositionWidth={width}
                        compositionHeight={height}
                        style={{ width: '100%', height: '100%' }}
                        controls={!isImage}
                        autoPlay={!isImage}
                        loop={!isImage}
                    />
                </div>

                {mockProps.isSandboxMock && (
                    <div className="absolute bottom-8 right-8 flex items-center gap-2 px-3 py-1.5 bg-red-900/40 border border-red-500/30 text-red-400 rounded-full text-xs font-mono">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        SPATIAL PLACEHOLDER ACTIVE
                    </div>
                )}
            </div>
        </div>
    );
}
