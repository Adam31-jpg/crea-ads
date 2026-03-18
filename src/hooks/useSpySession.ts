import { create } from "zustand";

export type SpyStep =
    | "url_input"
    | "store_review"
    | "competitors"
    | "creatives"
    | "generating"
    | "results";

export interface StoreAnalysis {
    id: string;
    storeUrl: string;
    storeName: string | null;
    productCategory: string | null;
    niche: string | null;
    priceRange: string | null;
    usps: string[] | null;
    toneOfVoice: string | null;
    targetMarket: string | null;
    status: string;
}

export interface Competitor {
    id: string;
    competitorName: string;
    competitorUrl: string | null;
    positioning: string | null;
    priceRange: string | null;
    marketingChannels: string[];
    relevanceScore: number;
    isSelected: boolean;
    isManual: boolean;
    metaAdLibraryUrl: string | null;
    tiktokAdLibraryUrl: string | null;
}

export interface CreativeBlueprint {
    id: string;
    competitorAnalysisId: string | null;
    storeAnalysisId: string;
    creativeName: string;
    creativeType: string;
    description: string;
    estimatedPerformance: { hookRate?: string; engagement?: string; format?: string } | null;
    reproductionPrompt: string;
    ugcScript: string | null;
    isSelected: boolean;
    aspectRatio: string;
    sourceLabel: string;
    status: string;
    competitorName?: string; // Denormalized for display
    sourceUrl?: string | null;
    sourceImageUrl?: string | null;
    sourcePlatform?: string | null;
}

export interface GeneratedJob {
    jobId: string;
    blueprintId: string;
    result_url: string;
    status: "rendering" | "done" | "failed";
    warning?: string;
}

interface SpySessionState {
    currentStep: SpyStep;
    storeAnalysis: StoreAnalysis | null;
    competitors: Competitor[];
    blueprints: CreativeBlueprint[];
    generatedJobs: GeneratedJob[];
    productImageUrl: string | null;

    setStep: (step: SpyStep) => void;
    setStoreAnalysis: (analysis: StoreAnalysis) => void;
    updateStoreAnalysis: (patch: Partial<StoreAnalysis>) => void;
    setCompetitors: (competitors: Competitor[]) => void;
    toggleCompetitor: (id: string) => void;
    addManualCompetitor: (competitor: Competitor) => void;
    setBlueprints: (blueprints: CreativeBlueprint[]) => void;
    toggleBlueprint: (id: string) => void;
    updateBlueprintPrompt: (id: string, prompt: string) => void;
    updateBlueprintAspectRatio: (id: string, aspectRatio: string) => void;
    addJob: (job: GeneratedJob) => void;
    updateJob: (jobId: string, patch: Partial<GeneratedJob>) => void;
    setProductImageUrl: (url: string) => void;
    reset: () => void;
}

const initialState = {
    currentStep: "url_input" as SpyStep,
    storeAnalysis: null,
    competitors: [],
    blueprints: [],
    generatedJobs: [],
    productImageUrl: null,
};

export const useSpySession = create<SpySessionState>((set) => ({
    ...initialState,

    setStep: (step) => set({ currentStep: step }),

    setStoreAnalysis: (analysis) => set({ storeAnalysis: analysis }),

    updateStoreAnalysis: (patch) =>
        set((state) => ({
            storeAnalysis: state.storeAnalysis ? { ...state.storeAnalysis, ...patch } : null,
        })),

    setCompetitors: (competitors) => set({ competitors }),

    toggleCompetitor: (id) =>
        set((state) => ({
            competitors: state.competitors.map((c) =>
                c.id === id ? { ...c, isSelected: !c.isSelected } : c,
            ),
        })),

    addManualCompetitor: (competitor) =>
        set((state) => ({ competitors: [...state.competitors, competitor] })),

    setBlueprints: (blueprints) => set({ blueprints }),

    toggleBlueprint: (id) =>
        set((state) => ({
            blueprints: state.blueprints.map((b) =>
                b.id === id ? { ...b, isSelected: !b.isSelected } : b,
            ),
        })),

    updateBlueprintPrompt: (id, prompt) =>
        set((state) => ({
            blueprints: state.blueprints.map((b) =>
                b.id === id ? { ...b, reproductionPrompt: prompt } : b,
            ),
        })),

    updateBlueprintAspectRatio: (id, aspectRatio) =>
        set((state) => ({
            blueprints: state.blueprints.map((b) =>
                b.id === id ? { ...b, aspectRatio } : b,
            ),
        })),

    addJob: (job) => set((state) => ({ generatedJobs: [...state.generatedJobs, job] })),

    updateJob: (jobId, patch) =>
        set((state) => ({
            generatedJobs: state.generatedJobs.map((j) =>
                j.jobId === jobId ? { ...j, ...patch } : j,
            ),
        })),

    setProductImageUrl: (url) => set({ productImageUrl: url }),

    reset: () => set(initialState),
}));
