import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    Easing,
} from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface HeroObjectProps {
    imageUrl: string;
    zoom?: number;
    color?: string;
    layoutType?: 'converter' | 'minimalist';
    aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
}

// ─── Animation constants ──────────────────────────────────────────────────────
// 3 complete float oscillations across the full video duration.
const FLOAT_CYCLES = 3;

// ─── DebugProbe ───────────────────────────────────────────────────────────────
// A small always-visible bright red cube positioned above the product.
// PURPOSE: Proves the 3D canvas is painting at all.
//   • If this cube IS visible in the render → the Canvas and WebGL are working.
//     The product itself is the problem (texture CORS / URL issue).
//   • If this cube is NOT visible → the entire <ThreeCanvas> layer is hidden
//     (z-index, opacity, or CSS occlusion).
// REMOVE this component once the root cause is confirmed.
const DebugProbe: React.FC<{ xOffset: number }> = ({ xOffset }) => (
    <mesh position={[xOffset, 4.2, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        {/* meshBasicMaterial is unaffected by scene lighting — always full-brightness red */}
        <meshBasicMaterial color="#FF0000" />
    </mesh>
);

// ─── DebugCube ────────────────────────────────────────────────────────────────
// A large red slab that occupies the same screen area as the product mesh.
// Rendered in place of the product when:
//   (a) The texture is still loading  — shown by the local <React.Suspense> fallback
//   (b) useLoader throws an error     — shown by TextureErrorBoundary
// Together with DebugProbe it gives a clear two-signal diagnostic:
//   • Red probe only              → texture loaded but product mesh invisible
//   • Red probe + DebugCube       → texture failed or is still loading
//   • Neither visible             → the 3D canvas is occluded entirely
const DebugCube: React.FC<{ xOffset: number }> = ({ xOffset }) => (
    <mesh position={[xOffset, 0, 0]}>
        <boxGeometry args={[3.5, 5, 0.3]} />
        <meshBasicMaterial color="#FF0000" />
    </mesh>
);

// ─── TextureErrorBoundary ─────────────────────────────────────────────────────
// Catches errors thrown by useLoader (CORS failures, 404s, etc.).
// Must live INSIDE Canvas so it can render R3F primitives in its fallback.
class TextureErrorBoundary extends React.Component<
    { children: React.ReactNode; xOffset: number },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode; xOffset: number }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error: Error) {
        console.error('[HeroObject] Texture load FAILED (CORS/404) — showing DebugCube:', error.message);
    }
    render() {
        if (this.state.hasError) {
            return <DebugCube xOffset={this.props.xOffset} />;
        }
        return this.props.children;
    }
}

// ─── ProductMesh ──────────────────────────────────────────────────────────────
// Contains useLoader: suspends (throws Promise) until texture is cached.
// Lives inside a local React.Suspense so the suspension is caught HERE, not
// by ThreeCanvas's outer SuspenseLoader. This lets lights and DebugProbe render
// immediately while ProductMesh is still waiting for the network.
interface ProductMeshProps {
    imageUrl: string;
    zoom: number;
    xOffset: number;
    floatY: number;
    rotationY: number;
}
const ProductMesh: React.FC<ProductMeshProps> = ({ imageUrl, zoom, xOffset, floatY, rotationY }) => {
    const texture = useLoader(THREE.TextureLoader, imageUrl, (loader) => {
        (loader as THREE.TextureLoader).setCrossOrigin('anonymous');
    }) as THREE.Texture;

    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const img = texture.image as HTMLImageElement;
    const imageAspect = img?.width && img?.height ? img.width / img.height : 1;
    const planeWidth  = 5 * imageAspect;
    const planeHeight = 5;

    return (
        <>
            <group position={[xOffset, floatY, 0]} rotation={[0, rotationY, 0]}>
                <mesh castShadow scale={[zoom, zoom, 1]}>
                    <planeGeometry args={[planeWidth, planeHeight, 1, 1]} />
                    <meshStandardMaterial
                        map={texture}
                        transparent
                        side={THREE.DoubleSide}
                        alphaTest={0.01}
                    />
                </mesh>
            </group>

            {/* Shadow catcher — grounded beneath the product */}
            <mesh position={[xOffset, -3.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[20, 20]} />
                <shadowMaterial opacity={0.3} transparent />
            </mesh>
        </>
    );
};

// ─── HeroScene ────────────────────────────────────────────────────────────────
// Orchestrates the 3D scene. Lights and DebugProbe live OUTSIDE the Suspense
// boundary so they always render regardless of texture state.
//
// Suspense hierarchy:
//   ThreeCanvas (outer SuspenseLoader — handles canvas creation delayRender)
//     └─ HeroScene
//          ├─ lights               ← always on
//          ├─ DebugProbe           ← always visible (diagnostic — remove for production)
//          └─ [imageUrl valid?]
//               YES → React.Suspense (local boundary for texture loading)
//                       ├─ fallback: DebugCube   ← shown while texture is loading
//                       └─ TextureErrorBoundary
//                            └─ ProductMesh      ← shown once texture is ready
//               NO  → DebugCube directly          ← URL was bad, signals the root cause
const HeroScene: React.FC<HeroObjectProps> = ({
    imageUrl,
    zoom = 1,
    color = '#ffffff',
    layoutType = 'converter',
    aspectRatio = '9:16',
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const progress  = frame / durationInFrames;
    const floatY    = Math.sin(progress * Math.PI * 2 * FLOAT_CYCLES) * 0.2;
    const rotationY = interpolate(
        frame,
        [0, durationInFrames],
        [-0.2, 0.2],
        { easing: Easing.bezier(0.42, 0, 0.58, 1) }
    );

    const xOffset =
        layoutType === 'converter'
            ? aspectRatio === '16:9' ? 3 : 2
            : 0;

    // A URL is valid only if it's a non-empty string that doesn't contain the
    // literal text "undefined", which indicates a broken upload path like
    // "https://…/storage/…/undefined/filename.jpg".
    const hasValidImageUrl =
        typeof imageUrl === 'string' &&
        imageUrl.trim() !== '' &&
        !imageUrl.includes('undefined');

    return (
        <>
            {/*
             * ─── Lighting ────────────────────────────────────────────────────
             * Defined outside the Suspense boundary so they are always present.
             * DebugCube / ProductMesh are both lit by these lights.
             */}
            <ambientLight intensity={2.0} />
            <directionalLight position={[5, 10, 5]}  intensity={4.0} castShadow />
            <directionalLight position={[-5, 5, 2]}  intensity={2.0} />
            <spotLight
                position={[0, 8, 8]}
                intensity={6}
                angle={0.4}
                penumbra={0.8}
                color={color}
            />

            {/*
             * DebugProbe — tiny always-visible red cube above the product.
             * DIAGNOSTIC: if this is visible → ThreeCanvas is painting.
             *             if this is NOT visible → the canvas layer is occluded.
             * Remove once root cause confirmed.
             */}
            <DebugProbe xOffset={xOffset} />

            {hasValidImageUrl ? (
                /*
                 * Normal path — local Suspense intercepts useLoader's Promise.
                 * While texture loads: DebugCube shows (loading signal).
                 * On CORS/404 error: TextureErrorBoundary shows DebugCube (error signal).
                 * On success: ProductMesh shows the actual product.
                 */
                <React.Suspense fallback={<DebugCube xOffset={xOffset} />}>
                    <TextureErrorBoundary xOffset={xOffset}>
                        <ProductMesh
                            imageUrl={imageUrl}
                            zoom={zoom}
                            xOffset={xOffset}
                            floatY={floatY}
                            rotationY={rotationY}
                        />
                    </TextureErrorBoundary>
                </React.Suspense>
            ) : (
                /*
                 * Bad URL path — skip ProductMesh entirely (do NOT call useLoader
                 * with an invalid URL; it would produce a confusing R3F error).
                 * DebugCube in the product slot signals the broken URL upstream.
                 */
                <DebugCube xOffset={xOffset} />
            )}
        </>
    );
};

// ─── HeroObject ───────────────────────────────────────────────────────────────
// NEVER returns null. Even with a bad imageUrl the ThreeCanvas always mounts
// so the DebugProbe is always visible — confirming the 3D layer is active.
export const HeroObject: React.FC<HeroObjectProps> = (props) => {
    const { width, height } = useVideoConfig();

    const urlIsValid =
        typeof props.imageUrl === 'string' &&
        props.imageUrl.trim() !== '' &&
        !props.imageUrl.includes('undefined');

    if (!urlIsValid) {
        console.error(
            '[HeroObject] Invalid/empty imageUrl received — 3D canvas will render debug geometry only:',
            props.imageUrl
        );
    }

    return (
        <AbsoluteFill>
            <ThreeCanvas
                width={width}
                height={height}
                style={{ backgroundColor: 'transparent' }}
                gl={{ alpha: true, preserveDrawingBuffer: true }}
                shadows
                orthographic={false}
                camera={{ position: [0, 0, 12], fov: 50 }}
            >
                {/* HeroScene checks its own urlIsValid — no need to short-circuit here */}
                <HeroScene {...props} />
            </ThreeCanvas>
        </AbsoluteFill>
    );
};
