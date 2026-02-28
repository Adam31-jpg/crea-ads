import React from 'react';
import type { ArrowConfig } from '../schema/project';

interface ArrowLayerProps {
    arrow: ArrowConfig;
    color?: string;
    strokeWidth?: number;
}

/**
 * Renders a curved SVG bezier arrow from startPos → endPos.
 *
 * startPos / endPos are percentages of the safe-zone container (0–100).
 * curvature: -1 = strongly concave arc, 0 = straight line, 1 = strongly convex arc.
 *
 * The control point is computed by offsetting the midpoint perpendicularly to
 * the line direction by an amount proportional to the curvature value:
 *   offset = curvature × 0.3 × lineLength   (in percentage units)
 *
 * The arrowhead is a simple filled triangle at endPos, rotated to match the
 * tangent angle of the bezier at t=1.
 */
export const ArrowLayer: React.FC<ArrowLayerProps> = ({
    arrow,
    color = '#FFFFFF',
    strokeWidth = 3,
}) => {
    const [x1, y1] = arrow.startPos;
    const [x2, y2] = arrow.endPos;

    // Mid-point
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    // Perpendicular offset (rotate direction 90°, scale by curvature & line length)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / len;
    const perpY = dx / len;
    const offsetMagnitude = arrow.curvature * len * 0.4;
    const cx = mx + perpX * offsetMagnitude;
    const cy = my + perpY * offsetMagnitude;

    // Quadratic bezier path string (coordinates in %)
    const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

    // Arrowhead: tangent at t=1 for Q-bezier = (endPoint - controlPoint)
    const tanX = x2 - cx;
    const tanY = y2 - cy;
    const tanAngle = Math.atan2(tanY, tanX) * (180 / Math.PI);

    // Arrowhead triangle (in absolute %) — drawn at (x2, y2), pointing in tanAngle
    const headLen = Math.max(strokeWidth * 3, 6);

    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                overflow: 'visible',
                zIndex: 23,
                pointerEvents: 'none',
            }}
        >
            {/* Subtle drop-shadow filter for legibility */}
            <defs>
                <filter id="arrow-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="rgba(0,0,0,0.7)" />
                </filter>
            </defs>

            {/* Bezier curve body */}
            <path
                d={pathD}
                stroke={color}
                strokeWidth={strokeWidth * 0.5}
                fill="none"
                strokeLinecap="round"
                filter="url(#arrow-shadow)"
            />

            {/* Arrowhead marker */}
            <g
                transform={`translate(${x2}, ${y2}) rotate(${tanAngle})`}
                filter="url(#arrow-shadow)"
            >
                <polygon
                    points={`${headLen},0 ${-headLen * 0.6},${headLen * 0.5} ${-headLen * 0.6},${-headLen * 0.5}`}
                    fill={color}
                />
            </g>
        </svg>
    );
};
