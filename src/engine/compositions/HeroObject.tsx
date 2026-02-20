import React, { Suspense } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { AssetLoader } from '../components/AssetLoader';

interface HeroObjectProps {
    imageUrl: string;
    zoom?: number;
}

const HeroScene: React.FC<HeroObjectProps> = ({ imageUrl, zoom = 1 }) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    // This hook suspends, but AssetLoader ensures the image is preloaded
    const texture = useTexture(imageUrl);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

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
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
            <spotLight position={[-5, 5, -5]} intensity={3} angle={0.5} penumbra={1} color="#ffffff" />

            <group position={[0, floatY, 0]} rotation={[0, rotationY, 0]}>
                <mesh position={[0, 0, 0]} castShadow>
                    <planeGeometry args={[planeWidth, planeHeight, 32, 32]} />
                    <meshStandardMaterial map={texture} transparent side={THREE.DoubleSide} alphaTest={0.5} />
                </mesh>
            </group>

            <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
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
