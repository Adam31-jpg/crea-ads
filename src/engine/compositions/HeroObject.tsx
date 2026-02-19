import React, { useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface HeroObjectProps {
    imageUrl: string;
    zoom?: number; // Optional zoom factor
}

const HeroScene: React.FC<HeroObjectProps> = ({ imageUrl, zoom = 1 }) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    // Load the texture
    const texture = useTexture(imageUrl);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    // Calculate aspect ratio of the image to scale the plane correctly
    const imageAspect = texture.image.width / texture.image.height;
    const planeWidth = 5 * imageAspect; // Base width
    const planeHeight = 5;

    // Animation: Floating (Sine Wave)
    const floatY = Math.sin(frame / fps * 2) * 0.2;

    // Animation: Rotation (Bézier)
    // Smooth ease-in-out rotation
    const rotationY = interpolate(
        frame,
        [0, durationInFrames],
        [-0.2, 0.2], // Slight rotation from left to right
        {
            easing: Easing.bezier(0.42, 0, 0.58, 1), // Ease-in-out
        }
    );

    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
            {/* Rim Light for that premium feel */}
            <spotLight
                position={[-5, 5, -5]}
                intensity={3}
                angle={0.5}
                penumbra={1}
                color="#ffffff"
            />

            <group position={[0, floatY, 0]} rotation={[0, rotationY, 0]}>
                {/* The Billboard (Product) */}
                <mesh position={[0, 0, 0]} castShadow>
                    <planeGeometry args={[planeWidth, planeHeight, 32, 32]} />
                    <meshStandardMaterial
                        map={texture}
                        transparent={true}
                        side={THREE.DoubleSide}
                        alphaTest={0.5} // Sharp edges for PNG transparency
                    />
                </mesh>
            </group>

            {/* Dynamic Drop Shadow on the floor */}
            <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[20, 20]} />
                <shadowMaterial opacity={0.3} transparent blur={1} />
            </mesh>
        </>
    );
};

export const HeroObject: React.FC<HeroObjectProps> = (props) => {
    const { width, height } = useVideoConfig();

    return (
        <AbsoluteFill>
            <ThreeCanvas
                width={width}
                height={height}
                style={{
                    backgroundColor: 'transparent',
                }}
                shadows
                orthographic={false}
                camera={{ position: [0, 0, 12], fov: 50 }}
            >
                <HeroScene {...props} />
            </ThreeCanvas>
        </AbsoluteFill>
    );
};
