import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface HeroObjectProps {
    imageUrl?: string;
    /** Bundle-aware product URL array (1–3 images). Takes precedence over imageUrl. */
    productImageUrls?: string[];
    zoom?: number;
    color?: string;
    layoutType?: 'converter' | 'minimalist';
    aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
    /** Dominant light direction from the Director's Brain — aligns 3D light with the background scene. */
    sceneLightDirection?: string;
    /** Surface material the product rests on — drives shadow opacity and tint. */
    contactSurface?: string;
    /** 3D lighting preset matching the background scene mood. */
    lightingIntent?: string;
}

// ─── Animation constants ──────────────────────────────────────────────────────
const FLOAT_CYCLES = 3;

// ─── Light Rig Lookup ─────────────────────────────────────────────────────────
const LIGHT_RIGS: Record<string, {
    primary: [number, number, number];
    fill: [number, number, number];
}> = {
    'top-left': { primary: [-5, 10, 5], fill: [4, 5, 2] },
    'top-right': { primary: [5, 10, 5], fill: [-4, 5, 2] },
    'overhead': { primary: [0, 12, 3], fill: [0, 5, -2] },
    'side-left': { primary: [-10, 5, 3], fill: [4, 8, 2] },
    'side-right': { primary: [10, 5, 3], fill: [-4, 8, 2] },
};
const DEFAULT_RIG = LIGHT_RIGS['top-right'];

// ─── Surface Shadow Lookup ────────────────────────────────────────────────────
const SURFACE_SHADOWS: Record<string, { opacity: number; color: string }> = {
    volcanic: { opacity: 0.75, color: '#1a0f0a' },
    marble: { opacity: 0.55, color: '#0f1420' },
    wood: { opacity: 0.60, color: '#1f1208' },
    glass: { opacity: 0.25, color: '#0a0a15' },
    stone: { opacity: 0.70, color: '#0f1a0f' },
    rubber: { opacity: 0.75, color: '#0a0a0a' },
    sand: { opacity: 0.55, color: '#1a1508' },
    ceramic: { opacity: 0.50, color: '#141414' },
};
const DEFAULT_SHADOW = SURFACE_SHADOWS['marble'];

// ─── Lighting Config Lookup ───────────────────────────────────────────────────
// Controls ambient/primary/fill intensities, rim light, and meshStandardMaterial
// roughness + metalness. Tuning these per scene mood is the key to making the
// flat-plane product look like a photograph rather than a sticker.
interface LightingConfig {
    ambientIntensity: number;
    primaryIntensity: number;
    fillIntensity: number;
    rimIntensity: number;
    rimColor: string;
    roughness: number;
    metalness: number;
}

const LIGHTING_CONFIGS: Record<string, LightingConfig> = {
    harsh_sunlight: { ambientIntensity: 1.0, primaryIntensity: 8.0, fillIntensity: 0.5, rimIntensity: 0, rimColor: '#ffffff', roughness: 0.10, metalness: 0.05 },
    soft_spa: { ambientIntensity: 3.5, primaryIntensity: 2.5, fillIntensity: 3.0, rimIntensity: 1.5, rimColor: '#fff8f0', roughness: 0.70, metalness: 0.00 },
    dramatic_window: { ambientIntensity: 0.8, primaryIntensity: 6.0, fillIntensity: 0.8, rimIntensity: 0.5, rimColor: '#f5e6d0', roughness: 0.15, metalness: 0.10 },
    rim_glow: { ambientIntensity: 1.5, primaryIntensity: 3.0, fillIntensity: 1.0, rimIntensity: 5.0, rimColor: '#d4af37', roughness: 0.05, metalness: 0.30 },
    clinical_bright: { ambientIntensity: 4.0, primaryIntensity: 3.0, fillIntensity: 4.0, rimIntensity: 0, rimColor: '#ffffff', roughness: 0.50, metalness: 0.00 },
    golden_hour: { ambientIntensity: 1.2, primaryIntensity: 5.0, fillIntensity: 1.5, rimIntensity: 3.0, rimColor: '#ffb347', roughness: 0.20, metalness: 0.15 },
};
const DEFAULT_LIGHTING = LIGHTING_CONFIGS['rim_glow'];

// ─── Group Shot Layout ────────────────────────────────────────────────────────
// Computes per-product 3D positioning for 1, 2, or 3 products.
// zDepth (negative = further from camera) creates genuine perspective-based
// depth scaling without any CSS tricks — products appear naturally smaller
// at distance with the fov:50 perspective camera.
interface ProductSlot {
    xOffset: number;
    zDepth: number;
    scale: number;
    floatPhase: number; // phase offset so products don't bob in sync
}

function buildGroupLayout(
    count: number,
    layoutType: 'converter' | 'minimalist',
): ProductSlot[] {
    const isConverter = layoutType === 'converter';

    if (count === 1) {
        return [{ xOffset: isConverter ? 2 : 0, zDepth: 0, scale: 1, floatPhase: 0 }];
    }
    if (count === 2) {
        return [
            { xOffset: isConverter ? 1 : -1.5, zDepth: 0, scale: 1.00, floatPhase: 0 },
            { xOffset: isConverter ? 3.5 : 1.5, zDepth: -1.5, scale: 0.75, floatPhase: 0.33 },
        ];
    }
    // count >= 3: left large, center medium, right small — classic "group shot"
    return [
        { xOffset: -2, zDepth: 0, scale: 1.00, floatPhase: 0 },
        { xOffset: 0, zDepth: -1.0, scale: 0.80, floatPhase: 0.25 },
        { xOffset: 2, zDepth: -2.5, scale: 0.60, floatPhase: 0.50 },
    ];
}

// ─── OnReadyEffect ────────────────────────────────────────────────────────────
const OnReadyEffect: React.FC<{ onReady: () => void }> = ({ onReady }) => {
    useEffect(() => { onReady(); }, [onReady]);
    return null;
};

// ─── TextureErrorBoundary ─────────────────────────────────────────────────────
class TextureErrorBoundary extends React.Component<
    { children: React.ReactNode; onReady: () => void },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode; onReady: () => void }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(error: Error) {
        console.error('[HeroObject] Texture load failed (CORS / 404):', error.message);
    }
    render() {
        if (this.state.hasError) return <OnReadyEffect onReady={this.props.onReady} />;
        return this.props.children;
    }
}

// ─── ProductMesh ──────────────────────────────────────────────────────────────
interface ProductMeshProps {
    imageUrl: string;
    zoom: number;
    slot: ProductSlot;
    floatY: number;
    rotationY: number;
    onReady: () => void;
    shadowOpacity: number;
    shadowColor: string;
    roughness: number;
    metalness: number;
}

const ProductMesh: React.FC<ProductMeshProps> = ({
    imageUrl,
    zoom,
    slot,
    floatY,
    rotationY,
    onReady,
    shadowOpacity,
    shadowColor,
    roughness,
    metalness,
}) => {
    const [texture, setTexture] = React.useState<THREE.Texture | null>(null);
    const { advance } = useThree();

    useEffect(() => {
        let isMounted = true;
        const loader = new THREE.TextureLoader();
        // Epic 9: Critical CORS enforcement prior to load to bypass 28s WebGL taint hang
        loader.setCrossOrigin('anonymous');

        // Epic 9: Chromium Taint Cache Buster
        const cacheBustedUrl = imageUrl.includes('?')
            ? `${imageUrl}&v=${Date.now()}`
            : `${imageUrl}?v=${Date.now()}`;

        // Epic 9: 27-second Lockbreaker Timeout
        const timeoutId = setTimeout(() => {
            if (!isMounted) return;
            const errMsg = `[HeroObject] TEXTURE_TIMEOUT_ERROR for product texture: ${imageUrl}`;
            console.error(errMsg);
            throw new Error(errMsg);
        }, 27000);

        loader.load(
            cacheBustedUrl,
            (tex) => {
                if (!isMounted) return;
                clearTimeout(timeoutId);
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                setTexture(tex);
                advance(performance.now());
                onReady();
            },
            undefined,
            (err) => {
                const errMsg = `[HeroObject] TEXTURE_LOAD_ERROR for product texture: ${imageUrl} - ${err}`;
                console.error(errMsg);
                if (!isMounted) return;
                clearTimeout(timeoutId);
                throw new Error(errMsg);
            }
        );

        return () => { isMounted = false; clearTimeout(timeoutId); };
    }, [imageUrl, onReady, advance]);

    if (!texture) return null;

    const img = texture.image as HTMLImageElement;
    const imageAspect = img?.width && img?.height ? img.width / img.height : 1;
    const planeWidth = 5 * imageAspect;
    const planeHeight = 5;

    const effectiveZoom = zoom * slot.scale;
    const phaseOffset = slot.floatPhase * Math.PI * 2;
    const slotFloatY = floatY + Math.sin(phaseOffset) * 0.05; // tiny extra phase per slot

    return (
        <>
            <group
                position={[slot.xOffset, slotFloatY, slot.zDepth]}
                rotation={[0, rotationY * (1 - slot.floatPhase * 0.5), 0]}
            >
                <mesh castShadow scale={[effectiveZoom, effectiveZoom, 1]}>
                    <planeGeometry args={[planeWidth, planeHeight, 1, 1]} />
                    <meshStandardMaterial
                        map={texture}
                        transparent
                        side={THREE.DoubleSide}
                        alphaTest={0.01}
                        roughness={roughness}
                        metalness={metalness}
                    />
                </mesh>
            </group>

            {/* Shadow catcher — per-slot, positioned at this product's base */}
            <mesh
                position={[slot.xOffset, -3.1 + slot.zDepth * 0.05, slot.zDepth]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[20, 20]} />
                <shadowMaterial color={shadowColor} opacity={shadowOpacity * slot.scale} transparent />
            </mesh>
        </>
    );
};

// ─── HeroScene ────────────────────────────────────────────────────────────────
interface HeroSceneProps extends HeroObjectProps {
    imageUrls: string[];
    onSlotReady: () => void;
}

const HeroScene: React.FC<HeroSceneProps> = ({
    imageUrls,
    zoom = 1,
    color = '#ffffff',
    layoutType = 'converter',
    aspectRatio = '9:16',
    sceneLightDirection,
    contactSurface,
    lightingIntent,
    onSlotReady,
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const progress = frame / durationInFrames;
    const floatY = Math.sin(progress * Math.PI * 2 * FLOAT_CYCLES) * 0.2;
    const rotationY = interpolate(
        frame,
        [0, durationInFrames],
        [-0.2, 0.2],
        { easing: Easing.bezier(0.42, 0, 0.58, 1) }
    );

    const rig = LIGHT_RIGS[sceneLightDirection ?? ''] ?? DEFAULT_RIG;
    const shadow = SURFACE_SHADOWS[contactSurface ?? ''] ?? DEFAULT_SHADOW;
    const lConfig = LIGHTING_CONFIGS[lightingIntent ?? ''] ?? DEFAULT_LIGHTING;

    const slots = buildGroupLayout(imageUrls.length, layoutType);

    // Configure the primary directional light's shadow map before the first
    // advance() flush so PCFSoftShadowMap renders at full 2048×2048 resolution.
    const dirLightRef = useRef<THREE.DirectionalLight>(null);
    useLayoutEffect(() => {
        const light = dirLightRef.current;
        if (!light) return;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 50;
        light.shadow.camera.left = -8;
        light.shadow.camera.right = 8;
        light.shadow.camera.top = 8;
        light.shadow.camera.bottom = -8;
        light.shadow.radius = 4;
        light.shadow.needsUpdate = true;
    }, []);

    return (
        <>
            <ambientLight intensity={lConfig.ambientIntensity} />
            <directionalLight
                ref={dirLightRef}
                position={rig.primary}
                intensity={lConfig.primaryIntensity}
                castShadow
            />
            <directionalLight position={rig.fill} intensity={lConfig.fillIntensity} />
            <spotLight
                position={[0, 8, 8]}
                intensity={6}
                angle={0.4}
                penumbra={0.8}
                color={color}
            />

            {/* Rim light — behind the product, creates contour glow separating it from background */}
            {lConfig.rimIntensity > 0 && (
                <pointLight
                    position={[0, 3, -8]}
                    intensity={lConfig.rimIntensity}
                    color={lConfig.rimColor}
                    distance={20}
                    decay={2}
                />
            )}

            {imageUrls.map((url, i) => {
                const isValid =
                    typeof url === 'string' &&
                    url.trim() !== '' &&
                    !url.includes('undefined');

                if (!isValid) {
                    return <OnReadyEffect key={i} onReady={onSlotReady} />;
                }

                return (
                    <React.Suspense key={i} fallback={null}>
                        <TextureErrorBoundary onReady={onSlotReady}>
                            <ProductMesh
                                imageUrl={url}
                                zoom={zoom}
                                slot={slots[i] ?? slots[0]}
                                floatY={floatY}
                                rotationY={rotationY}
                                onReady={onSlotReady}
                                shadowOpacity={shadow.opacity}
                                shadowColor={shadow.color}
                                roughness={lConfig.roughness}
                                metalness={lConfig.metalness}
                            />
                        </TextureErrorBoundary>
                    </React.Suspense>
                );
            })}
        </>
    );
};

// ─── HeroObject ───────────────────────────────────────────────────────────────
// Top-level wrapper. Owns a counter-based Remotion delayRender gate that waits
// for ALL product textures to load before unblocking the screenshot pipeline.
export const HeroObject: React.FC<HeroObjectProps> = (props) => {
    const { width, height } = useVideoConfig();

    // Resolve the authoritative URL list: bundle array > single imageUrl fallback.
    const imageUrls = useMemo(
        () =>
            props.productImageUrls && props.productImageUrls.length > 0
                ? props.productImageUrls
                : [props.imageUrl ?? ''],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const totalCount = imageUrls.length;

    // Counter gate — opens only after every slot's texture is in the GL buffer.
    // useMemo fires synchronously during the first render, satisfying Remotion's
    // requirement that delayRender is called before any async work begins.
    const handle = useMemo(
        () => delayRender(`Waiting for ${totalCount} product texture(s)`),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const loadedCount = useRef(0);

    const onSlotReady = useCallback(() => {
        loadedCount.current += 1;
        if (loadedCount.current >= totalCount) {
            continueRender(handle);
        }
    }, [handle, totalCount]);

    return (
        <AbsoluteFill>
            <ThreeCanvas
                width={width}
                height={height}
                style={{ backgroundColor: 'transparent' }}
                gl={{ alpha: true, preserveDrawingBuffer: true }}
                shadows="soft"
                orthographic={false}
                camera={{ position: [0, 0, 12], fov: 50 }}
            >
                <HeroScene
                    {...props}
                    imageUrls={imageUrls}
                    onSlotReady={onSlotReady}
                />
            </ThreeCanvas>
        </AbsoluteFill>
    );
};
