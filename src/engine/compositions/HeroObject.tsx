import React, { Suspense } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, delayRender, continueRender } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { AssetLoader } from '../components/AssetLoader';
import { toast } from "sonner";

interface HeroObjectProps {
    imageUrl: string;
    zoom?: number;
    color?: string;
}

const HeroScene: React.FC<HeroObjectProps> = ({ imageUrl, zoom = 1, color = "#ffffff" }) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    const [texture, setTexture] = React.useState<THREE.Texture | null>(null);

    // 1. Add a cache-buster to the asset URL to bypass Lambda's Chromium cache
    const textureUrl = `${imageUrl}?v=${Date.now()}`;

    // Debug: Check if textureUrl is valid
    console.log("[DEBUG-RENDER] Raw imageUrl:", imageUrl);
    if (!imageUrl || imageUrl.includes("undefined")) {
        console.error("[HeroObject] CRITICAL: textureUrl is undefined or invalid!", textureUrl);
    }

    React.useEffect(() => {
        const handle = delayRender("Loading: " + textureUrl);
        console.log("[DEBUG-RENDER] Product URL:", textureUrl);

        let isMounted = true;
        let img: HTMLImageElement | null = null;

        const loadImage = () => {
            if (typeof window === 'undefined') return;

            // Pre-flight check via standard HTML Image
            img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = () => {
                const loader = new THREE.TextureLoader();
                loader.setCrossOrigin("anonymous");

                loader.load(
                    textureUrl,
                    (tex) => {
                        if (!isMounted) return;
                        tex.minFilter = THREE.LinearFilter;
                        tex.magFilter = THREE.LinearFilter;
                        tex.needsUpdate = true;
                        setTexture(tex);
                        try { continueRender(handle); } catch (e) { }
                    },
                    undefined,
                    (err) => {
                        console.error("Texture loader failed:", err);
                        try { continueRender(handle); } catch (e) { }
                    }
                );
            };

            img.onerror = (e) => {
                console.error("Asset strictly unreachable (CORS/404) on Image Tag:", textureUrl, e);
                toast.error("Unable to load product image. Please check your storage settings (CORS).");
                // We fail gracefully to not hang the renderer, but the texture will be missing
                try { continueRender(handle); } catch (err) { }
            };

            // Init load
            img.src = textureUrl;
        };

        // Task A & C: Pre-flight check via standard fetch to get exact HTTP status
        fetch(textureUrl, { method: 'HEAD', mode: 'cors' })
            .then(res => {
                if (isMounted) {
                    console.log(`[DEBUG-RENDER] Pre-flight HEAD status for ${textureUrl}: ${res.status} ${res.statusText}`);
                    if (res.ok) {
                        loadImage();
                    } else {
                        console.error(`[DEBUG-RENDER] Pre-flight fetch failed: HTTP ${res.status} - ${res.statusText}`);
                        toast.error(`Erreur ${res.status}: Image produit introuvable.`);
                        try { continueRender(handle); } catch (e) { }
                    }
                }
            })
            .catch(err => {
                if (isMounted) {
                    console.error("[DEBUG-RENDER] Pre-flight fetch completely blocked (likely strict CORS or Network down):", err);
                    loadImage(); // try anyway in case HEAD was just blocked
                }
            });

        const backupTimeout = setTimeout(() => {
            console.warn("Texture load timed out. Releasing lock to prevent deadlock.");
            try { continueRender(handle); } catch (e) { }
        }, 20000);

        return () => {
            isMounted = false;
            clearTimeout(backupTimeout);
            if (img) {
                img.onload = null;
                img.onerror = null;
            }
            try { continueRender(handle); } catch (e) { }
        };
    }, [textureUrl]);

    if (!texture) return null;

    const img = texture.image as HTMLImageElement;
    const imageAspect = img.width / img.height;
    const planeWidth = 5 * imageAspect;
    const planeHeight = 5;

    const floatY = Math.sin(frame / fps * 2) * 0.2;
    const rotationY = interpolate(
        frame,
        [0, durationInFrames],
        [-0.2, 0.2],
        { easing: Easing.bezier(0.42, 0, 0.58, 1) }
    );

    return (
        <>
            <ambientLight intensity={1.2} />
            <directionalLight position={[5, 10, 5]} intensity={2.5} castShadow />
            <spotLight position={[-5, 5, -5]} intensity={4} angle={0.5} penumbra={1} color={color} />

            <group position={[0, floatY, 0]} rotation={[0, rotationY, 0]}>
                <mesh position={[0, 0, 0]} castShadow>
                    <planeGeometry args={[planeWidth, planeHeight, 32, 32]} />
                    <meshStandardMaterial map={texture} transparent side={THREE.DoubleSide} />
                </mesh>
            </group>

            <mesh position={[0, -3.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[20, 20]} />
                <shadowMaterial opacity={0.3} transparent />
            </mesh>
        </>
    );
};

export const HeroObject: React.FC<HeroObjectProps> = (props) => {
    const { width, height } = useVideoConfig();

    return (
        <AbsoluteFill>
            <AssetLoader src={props.imageUrl} type="image">
                {() => (
                    <ThreeCanvas
                        width={width}
                        height={height}
                        style={{ backgroundColor: 'transparent' }}
                        shadows
                        orthographic={false}
                        camera={{ position: [0, 0, 12], fov: 50 }}
                    >
                        <Suspense fallback={null}>
                            <HeroScene {...props} />
                        </Suspense>
                    </ThreeCanvas>
                )}
            </AssetLoader>
        </AbsoluteFill>
    );
};
