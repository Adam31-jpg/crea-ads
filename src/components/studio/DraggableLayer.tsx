import React, { useRef, useEffect } from 'react';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import { useStudioStore } from '@/store/studio';

interface DraggableLayerProps {
    id?: string;
    layoutConfigKey?: 'headline' | 'social_proof' | 'arrow' | 'trust_bar' | 'logo' | 'features';
    initialX: number; // Percentage
    initialY: number; // Percentage
    initialZIndex?: number;
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    disabled?: boolean;
}

export const DraggableLayer: React.FC<DraggableLayerProps> = ({
    id, layoutConfigKey, initialX, initialY, initialZIndex, children, style, className, disabled
}) => {
    const { updateElementPosition, updateLayoutConfigPosition, setSelectedElementId } = useStudioStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const controls = useAnimation();

    // Reset x/y transform when initialX/initialY change externally (e.g. from props update)
    useEffect(() => {
        controls.set({ x: 0, y: 0 });
    }, [initialX, initialY, controls]);

    const handleDragEnd = (event: any, info: PanInfo) => {
        if (!containerRef.current) return;
        const parent = containerRef.current.parentElement;
        if (!parent) return;

        const parentRect = parent.getBoundingClientRect();

        // info.offset is the delta in screen pixels.
        const deltaXPercent = (info.offset.x / parentRect.width) * 100;
        const deltaYPercent = (info.offset.y / parentRect.height) * 100;

        const newX = Math.max(0, Math.min(100, initialX + deltaXPercent));
        const newY = Math.max(0, Math.min(100, initialY + deltaYPercent));

        if (id) {
            updateElementPosition(id, newX, newY);
        } else if (layoutConfigKey) {
            updateLayoutConfigPosition(layoutConfigKey, newX, newY);
        }

        // Instantly reset the transform so the updated absolute left/top takes over
        controls.set({ x: 0, y: 0 });
    };

    return (
        <motion.div
            ref={containerRef}
            drag={!disabled}
            dragMomentum={false}
            dragElastic={0}
            onDragEnd={handleDragEnd}
            onClick={(e) => {
                e.stopPropagation();
                if (id) setSelectedElementId(id);
                else if (layoutConfigKey) setSelectedElementId(layoutConfigKey);
            }}
            animate={controls}
            style={{
                position: 'absolute',
                left: `${initialX}%`,
                top: `${initialY}%`,
                zIndex: initialZIndex !== undefined ? initialZIndex : undefined,
                cursor: disabled ? 'default' : 'grab',
                ...style,
            }}
            whileDrag={{ cursor: 'grabbing', zIndex: 50, scale: 1.02 }}
            className={`group ${className || ''}`}
        >
            {/* Outline hover effect for Studio affordance */}
            {!disabled && (
                <div className="absolute inset-[-8px] border-2 border-brand/0 group-hover:border-brand/50 rounded-lg pointer-events-none transition-colors" />
            )}
            {children}
        </motion.div>
    );
};
