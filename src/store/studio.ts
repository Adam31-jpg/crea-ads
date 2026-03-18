import { create } from 'zustand';
import { RemotionProps } from '@/engine/schema/project';

interface StudioState {
    props: RemotionProps | null;
    selectedElementId: string | null;
    isInitializing: boolean;
    setProps: (props: RemotionProps) => void;
    updateProp: <K extends keyof RemotionProps>(key: K, value: RemotionProps[K]) => void;
    updateElementValue: (id: string, newContent: string) => void;
    updateElementPosition: (id: string, x: number, y: number) => void;
    updateElementZIndex: (id: string, delta: number) => void;
    updateLayoutConfigPosition: (key: 'headline' | 'social_proof' | 'arrow' | 'trust_bar' | 'logo' | 'features', x: number, y: number) => void;
    updateLayoutConfigZIndex: (key: 'headline' | 'social_proof' | 'arrow' | 'trust_bar' | 'logo' | 'features', delta: number) => void;
    setSelectedElementId: (id: string | null) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
    props: null,
    selectedElementId: null,
    isInitializing: true,
    setProps: (props) => set({ props, isInitializing: false }),

    updateProp: (key, value) => set((state) => ({
        props: state.props ? { ...state.props, [key]: value } : null
    })),

    updateElementValue: (id, newContent) => set((state) => {
        if (!state.props) return state;
        const elements = state.props.elements.map(el =>
            el.id === id ? { ...el, content: newContent } : el
        );
        return { props: { ...state.props, elements } };
    }),

    updateElementPosition: (id, x, y) => set((state) => {
        if (!state.props) return state;
        const elements = state.props.elements.map(el =>
            el.id === id ? { ...el, x, y } : el
        );
        return { props: { ...state.props, elements } };
    }),

    updateElementZIndex: (id, delta) => set((state) => {
        if (!state.props) return state;
        const elements = state.props.elements.map(el => {
            if (el.id === id) {
                const currentZ = el.z_index ?? 20;
                return { ...el, z_index: Math.max(0, currentZ + delta) };
            }
            return el;
        });
        return { props: { ...state.props, elements } };
    }),

    updateLayoutConfigPosition: (key, x, y) => set((state) => {
        if (!state.props || !state.props.layout_config) return state;

        const config = state.props.layout_config;
        const updatedConfig = { ...config };

        if (key === 'headline' && config.headline) {
            updatedConfig.headline = { ...config.headline, x, y };
        } else if (key === 'social_proof' && config.social_proof) {
            updatedConfig.social_proof = { ...config.social_proof, x, y };
        } else if (key === 'trust_bar' && config.trust_bar) {
            updatedConfig.trust_bar = { ...config.trust_bar, y_position: y };
        } else if (key === 'logo') {
            updatedConfig.logo = { x, y };
        } else if (key === 'features') {
            updatedConfig.features = { x, y };
        } else if (key === 'arrow' && config.arrow) {
            // Very basic translation for arrow start/end
            const dx = x - config.arrow.startPos[0];
            const dy = y - config.arrow.startPos[1];
            updatedConfig.arrow = {
                ...config.arrow,
                startPos: [x, y],
                endPos: [config.arrow.endPos[0] + dx, config.arrow.endPos[1] + dy]
            };
        }

        return {
            props: {
                ...state.props,
                layout_config: updatedConfig
            }
        };
    }),

    updateLayoutConfigZIndex: (key, delta) => set((state) => {
        if (!state.props || !state.props.layout_config) return state;
        const config = state.props.layout_config;
        const updatedConfig = { ...config };

        const getNewZ = (current?: number) => Math.max(0, (current ?? 20) + delta);

        if (key === 'headline' && config.headline) {
            updatedConfig.headline = { ...config.headline, z_index: getNewZ(config.headline.z_index) };
        } else if (key === 'logo' && config.logo) {
            updatedConfig.logo = { ...config.logo, z_index: getNewZ(config.logo.z_index) };
        } else if (key === 'features' && config.features) {
            updatedConfig.features = { ...config.features, z_index: getNewZ(config.features.z_index) };
        }
        return { props: { ...state.props, layout_config: updatedConfig } };
    }),

    setSelectedElementId: (id) => set({ selectedElementId: id }),
}));
