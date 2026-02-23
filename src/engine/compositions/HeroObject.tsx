import React, { useCallback, useEffect, useMemo } from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    Easing,
    delayRender,
    continueRender,
} from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface HeroObjectProps {
    imageUrl: string;
    zoom?: number;
    color?: string;
    layoutType?: 'converter' | 'minimalist';
    aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
}

// ─── Animation constants ──────────────────────────────────────────────────────
const FLOAT_CYCLES = 3;

// ─── OnReadyEffect ────────────────────────────────────────────────────────────
// A zero-geometry R3F node whose only job is to fire onReady() once on mount.
// Used as the terminal node in every scene branch so that continueRender is
// always called exactly once regardless of which path was taken:
//   • texture loaded successfully  → ProductMesh mounts → fires onReady
//   • texture CORS / 404 error     → ErrorBoundary fallback mounts → fires onReady
//   • imageUrl was invalid         → renders OnReadyEffect directly → fires onReady
const OnReadyEffect: React.FC<{ onReady: () => void }> = ({ onReady }) => {
    useEffect(() => {
        onReady();
    }, [onReady]);
    return null;
};

// ─── TextureErrorBoundary ─────────────────────────────────────────────────────
// Catches errors thrown by useLoader (CORS failures, 404s, network timeouts).
// Must live INSIDE Canvas so it can render R3F primitives in its fallback.
// Accepts onReady so it can release the Remotion delayRender gate even on error.
class TextureErrorBoundary extends React.Component<
    { children: React.ReactNode; onReady: () => void },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode; onReady: () => void }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error: Error) {
        console.error('[HeroObject] Texture load failed (CORS / 404):', error.message);
    }
    render() {
        if (this.state.hasError) {
            // Nothing visible rendered — product slot is empty on error.
            // OnReadyEffect still fires so the render gate is released.
            return <OnReadyEffect onReady={this.props.onReady} />;
        }
        return this.props.children;
    }
}

// ─── ProductMesh ──────────────────────────────────────────────────────────────
// Contains useLoader which suspends (throws a Promise) until the texture is
// cached by Three.js. The component can only mount AFTER the texture resolves,
// making useEffect a reliable post-load signal.
interface ProductMeshProps {
    imageUrl: string;
    zoom: number;
    xOffset: number;
    floatY: number;
    rotationY: number;
    onReady: () => void;
}

const ProductMesh: React.FC<ProductMeshProps> = ({
    imageUrl,
    zoom,
    xOffset,
    floatY,
    rotationY,
    onReady,
}) => {
    const texture = useLoader(THREE.TextureLoader, imageUrl, (loader) => {
        (loader as THREE.TextureLoader).setCrossOrigin('anonymous');
    }) as THREE.Texture;

    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const img = texture.image as HTMLImageElement;
    const imageAspect = img?.width && img?.height ? img.width / img.height : 1;
    const planeWidth  = 5 * imageAspect;
    const planeHeight = 5;

    // `advance` drives R3F's demand-mode render loop. ThreeCanvas renders one
    // empty frame during canvas creation (its own delayRender pass), then idles.
    // When ProductMesh mounts the texture is loaded but the GL buffer still shows
    // that empty first frame. Calling advance() here forces a second render pass
    // that writes the textured product into the WebGL buffer *before* we call
    // onReady() — ensuring Puppeteer screenshots the correct, fully-painted frame.
    const { advance } = useThree();

    useEffect(() => {
        advance(performance.now()); // flush texture → GL buffer
        onReady();                  // release Remotion's screenshot gate
    }, [onReady, advance]);

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

            {/* Shadow catcher grounded beneath the product */}
            <mesh position={[xOffset, -3.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[20, 20]} />
                <shadowMaterial opacity={0.3} transparent />
            </mesh>
        </>
    );
};

// ─── HeroScene ────────────────────────────────────────────────────────────────
// Orchestrates the 3D scene. Lights live outside the Suspense boundary so
// they are always present regardless of texture state.
//
// Rendering paths:
//   imageUrl valid
//     └─ React.Suspense (local — intercepts useLoader's thrown Promise)
//          ├─ fallback: null (product slot empty while texture loads)
//          └─ TextureErrorBoundary
//               ├─ error: OnReadyEffect (releases gate, empty product slot)
//               └─ ProductMesh (texture ready → fires onReady via useEffect)
//   imageUrl invalid
//     └─ OnReadyEffect (releases gate immediately, empty product slot)
interface HeroSceneProps extends HeroObjectProps {
    onTextureReady: () => void;
}

const HeroScene: React.FC<HeroSceneProps> = ({
    imageUrl,
    zoom = 1,
    color = '#ffffff',
    layoutType = 'converter',
    aspectRatio = '9:16',
    onTextureReady,
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

    // Guard against broken Supabase storage paths that contain the literal
    // text "undefined" (e.g. "…/product-assets/undefined/filename.jpg").
    const hasValidImageUrl =
        typeof imageUrl === 'string' &&
        imageUrl.trim() !== '' &&
        !imageUrl.includes('undefined');

    return (
        <>
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

            {hasValidImageUrl ? (
                <React.Suspense fallback={null}>
                    <TextureErrorBoundary onReady={onTextureReady}>
                        <ProductMesh
                            imageUrl={imageUrl}
                            zoom={zoom}
                            xOffset={xOffset}
                            floatY={floatY}
                            rotationY={rotationY}
                            onReady={onTextureReady}
                        />
                    </TextureErrorBoundary>
                </React.Suspense>
            ) : (
                // URL is invalid — release the delay gate immediately so the
                // render does not hang. Product slot will be empty.
                <OnReadyEffect onReady={onTextureReady} />
            )}
        </>
    );
};

// ─── HeroObject ───────────────────────────────────────────────────────────────
// Top-level wrapper that owns the Remotion delayRender gate.
//
// Why useMemo for delayRender?
//   delayRender must be called synchronously during component initialisation —
//   before ThreeCanvas or any child renders. useMemo with [] runs exactly once,
//   at the moment the component is first evaluated, satisfying that constraint.
//   A useState initialiser would also work but introduces an unnecessary setter.
//
// Why a separate gate rather than relying on ThreeCanvas's internal one?
//   ThreeCanvas's internal delayRender is released after state.advance() (canvas
//   creation + one render pass). That happens before the texture is loaded via
//   useLoader. Our gate is released only after ProductMesh mounts, guaranteeing
//   the texture is in the WebGL buffer when Puppeteer takes the screenshot.
export const HeroObject: React.FC<HeroObjectProps> = (props) => {
    const { width, height } = useVideoConfig();

    const handle = useMemo(
        () => delayRender('Waiting for product texture to load'),
        []
    );

    const onTextureReady = useCallback(
        () => continueRender(handle),
        [handle]
    );

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
                <HeroScene {...props} onTextureReady={onTextureReady} />
            </ThreeCanvas>
        </AbsoluteFill>
    );
};
