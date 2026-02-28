import React from 'react';
import { AbsoluteFill } from 'remotion';

export const ShapeOverlay: React.FC<{
    x: number;
    y: number;
    color?: string;
    opacity?: number;
}> = ({ x, y, color = '#ffffff', opacity = 0.1 }) => {
    return (
        <AbsoluteFill style={{ pointerEvents: 'none', zIndex: -1 }}>
            <svg
                style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '600px',
                    height: '600px',
                    opacity,
                }}
                viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path fill={color} d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,80.7,-46.4C89.7,-33.7,94.5,-18.4,94.3,-3.3C94,-11.9,88.5,23.1,77.7,33.5C66.8,43.9,50.7,49.6,35.8,55.8C20.8,62,7.1,68.7,-7,79.6C-21.2,90.5,-35.8,105.7,-48.5,102.6C-61.2,99.5,-72,78,-80.4,60.8C-88.7,43.5,-94.6,30.6,-96.2,16.8C-97.7,2.9,-95,-11.8,-89,-24.5C-83.1,-37.2,-74,-48,-62.1,-55.8C-50.2,-63.6,-35.6,-68.6,-21.8,-74.6C-8.1,-80.6,4.7,-87.7,19,-84C33.2,-80.3,46.1,-65.8,44.7,-76.4Z" transform="translate(100 100) scale(1.1)" />
            </svg>
        </AbsoluteFill>
    );
};
