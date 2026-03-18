"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
    Eye,
    Loader2,
    Download,
    RefreshCw,
    Plus,
    Camera,
    Zap,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Check,
    ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { cn } from "@/lib/utils";

import {
    useSpySession,
    type CreativeBlueprint,
    type GeneratedJob,
} from "@/hooks/useSpySession";
import { StoreAnalysisForm } from "@/components/spy/StoreAnalysisForm";
import { CompetitorList } from "@/components/spy/CompetitorList";
import { CreativePreview } from "@/components/spy/CreativePreview";
import { CardSkeleton, ProgressMessage } from "@/components/spy/SpySkeleton";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["store_review", "competitors", "creatives"] as const;
const STEP_LABELS = ["Store", "Competitors", "Creatives & Results"];

const TYPE_COLORS: Record<string, string> = {
    ugc_video: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    flat_lay: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    comparison: "bg-green-500/15 text-green-400 border-green-500/30",
    asmr: "bg-pink-500/15 text-pink-400 border-pink-500/30",
    lifestyle: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    carousel: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    testimonial: "bg-teal-500/15 text-teal-400 border-teal-500/30",
};

const SOURCE_STYLES = {
    cloned_from_competitor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    market_trend: "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

const LANG_FLAGS: Record<string, string> = { fr: "🇫🇷", en: "🇬🇧", de: "🇩🇪", es: "🇪🇸", it: "🇮🇹" };
const LANG_MAP: Record<string, string> = {
    fr: "French (Français)",
    en: "English",
    de: "German (Deutsch)",
    es: "Spanish (Español)",
    it: "Italian (Italiano)",
};
const RESOLUTION_COSTS: Record<string, number> = { "1K": 1, "2K": 2, "4K": 3 };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SpyProjectPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const t = useTranslations("SpyMode");
    const { data: session } = useSession();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [globalResolution, setGlobalResolution] = useState<"1K" | "2K" | "4K">("1K");
    const [creativeLang, setCreativeLang] = useState<"fr" | "en" | "de" | "es" | "it">("fr");
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExpanding, setIsExpanding] = useState(false);
    const [expandExhausted, setExpandExhausted] = useState(false);

    const {
        currentStep,
        setStep,
        storeAnalysis,
        competitors,
        blueprints,
        generatedJobs,
        productImageUrl,
        setProductImageUrl,
        setStoreAnalysis,
        setCompetitors,
        setBlueprints,
        toggleBlueprint,
        updateBlueprintPrompt,
        updateBlueprintAspectRatio,
        addJob,
        updateJob,
        reset,
    } = useSpySession();

    // ── Load project from DB ─────────────────────────────────────────────────
    useEffect(() => {
        async function loadProject() {
            try {
                const res = await fetch(`/api/spy/project/${projectId}`);
                if (!res.ok) { router.push("/dashboard/spy"); return; }
                const data = await res.json();

                setStoreAnalysis(data.storeAnalysis);
                if (data.competitors.length > 0) setCompetitors(data.competitors);
                if (data.blueprints.length > 0) setBlueprints(data.blueprints);
                if (data.jobs.length > 0) data.jobs.forEach((j: GeneratedJob) => addJob(j));

                if (data.blueprints.length > 0 || data.competitors.length > 0) {
                    setStep("creatives");
                } else if (data.competitors.length > 0) {
                    setStep("competitors");
                } else {
                    setStep("store_review");
                }
            } catch {
                toast.error("Failed to load project.");
                router.push("/dashboard/spy");
            } finally {
                setIsLoading(false);
            }
        }
        loadProject();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    // ── Poll every 4s as belt-and-suspenders for SSE gaps ────────────────────
    const [pollTick, setPollTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setPollTick((t) => t + 1), 4000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        if (isLoading || pollTick === 0) return;
        fetch(`/api/spy/project/${projectId}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.jobs?.length) {
                    data.jobs.forEach((j: GeneratedJob) => {
                        updateJob(j.jobId, { status: j.status as GeneratedJob["status"], result_url: j.result_url ?? "" });
                    });
                }
            })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pollTick]);

    // ── SSE ──────────────────────────────────────────────────────────────────
    const eventSourceRef = useRef<EventSource | null>(null);
    useEffect(() => {
        if (!session?.user) return;
        let es: EventSource;
        function connect() {
            es = new EventSource("/api/events");
            eventSourceRef.current = es;
            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "job_update") {
                        updateJob(data.jobId, { status: data.status, result_url: data.result_url, warning: data.warning });
                        if (data.status === "done") toast.success("Creative generated!");
                        else if (data.status === "failed") toast.error(t("errors.generationFailed"));
                    }
                } catch {}
            };
            es.onerror = () => {
                es.close();
                setTimeout(connect, 2000);
            };
        }
        connect();
        return () => es?.close();
    }, [session, updateJob, t]);

    // ── Upload ────────────────────────────────────────────────────────────────
    async function uploadImage(file: File): Promise<string | null> {
        try {
            const presignRes = await fetch("/api/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, contentType: file.type }),
            });
            if (!presignRes.ok) throw new Error("presign failed");
            const { presignedUrl, publicUrl } = await presignRes.json();
            const uploadRes = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
            if (!uploadRes.ok) throw new Error("s3 upload failed");
            return publicUrl;
        } catch {
            return null;
        }
    }

    async function handleGlobalImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = await uploadImage(file);
        if (url) { setProductImageUrl(url); toast.success(t("productImageReady")); }
        else toast.error("Upload failed. Please try again.");
    }

    // ── Extract creatives ─────────────────────────────────────────────────────
    async function handleExtract() {
        if (!storeAnalysis?.id) return;
        const selectedIds = competitors.filter((c) => c.isSelected && !c.id.startsWith("manual_")).map((c) => c.id);
        if (selectedIds.length === 0) { toast.error("No valid competitors selected."); return; }
        setIsExtracting(true);
        try {
            const res = await fetch("/api/spy/extract-creatives", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeAnalysisId: storeAnalysis.id, competitorIds: selectedIds, targetLanguage: creativeLang }),
            });
            const data = await res.json();
            if (data.status === "done" && Array.isArray(data.blueprints)) {
                const cMap = Object.fromEntries(competitors.map((c) => [c.id, c.competitorName]));
                setBlueprints(data.blueprints.map((b: CreativeBlueprint) => ({
                    ...b,
                    competitorName: b.competitorAnalysisId ? cMap[b.competitorAnalysisId] : undefined,
                })));
                setExpandExhausted(false);
            } else {
                toast.error("Extraction failed.");
            }
        } catch {
            toast.error("Extraction failed. Please try again.");
        } finally {
            setIsExtracting(false);
        }
    }

    // ── Expand analysis ───────────────────────────────────────────────────────
    async function handleExpand() {
        if (!storeAnalysis?.id || isExpanding) return;
        setIsExpanding(true);
        try {
            const selectedIds = competitors.filter((c) => c.isSelected && !c.id.startsWith("manual_")).map((c) => c.id);
            const res = await fetch("/api/spy/expand-creatives", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    storeAnalysisId: storeAnalysis.id,
                    competitorIds: selectedIds,
                    existingBlueprintIds: blueprints.map((b) => b.id),
                    targetLanguage: creativeLang,
                }),
            });
            const data = await res.json();
            if (data.status === "done" && Array.isArray(data.blueprints)) {
                if (data.blueprints.length === 0) {
                    setExpandExhausted(true);
                    toast.info(t("expandEmpty"));
                } else {
                    const cMap = Object.fromEntries(competitors.map((c) => [c.id, c.competitorName]));
                    const newBlueprints = data.blueprints.map((b: CreativeBlueprint) => ({
                        ...b,
                        competitorName: b.competitorAnalysisId ? cMap[b.competitorAnalysisId] : undefined,
                    }));
                    setBlueprints([...blueprints, ...newBlueprints]);
                    toast.success(`${data.blueprints.length} ${t("expandDone")}`);
                }
            }
        } catch {
            toast.error("Expansion failed.");
        } finally {
            setIsExpanding(false);
        }
    }

    // ── Generate single ───────────────────────────────────────────────────────
    const handleGenerateSingle = useCallback(
        async (blueprint: CreativeBlueprint, customImgUrl?: string | null) => {
            const imgUrl = customImgUrl ?? productImageUrl ?? null;
            if (!imgUrl) {
                toast.warning(t("noProductWarning"));
            }

            const promptWithLang = `${blueprint.reproductionPrompt}\n\nIMPORTANT: All text, headlines, CTAs, and copy in this creative MUST be written in ${LANG_MAP[creativeLang]}. Generate native-level marketing copy in this language.`;

            addJob({ jobId: `pending_${blueprint.id}`, blueprintId: blueprint.id, result_url: "", status: "rendering" });

            try {
                const res = await fetch("/api/spy/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ blueprintId: blueprint.id, productImageUrl: imgUrl, resolution: globalResolution, prompt: promptWithLang }),
                });
                const data = await res.json();

                if (res.status === 402) {
                    toast.error(t("errors.insufficientSparks"));
                    updateJob(`pending_${blueprint.id}`, { status: "failed" });
                    return;
                }
                if (!res.ok || data.error) {
                    toast.error(t("errors.generationFailed"));
                    updateJob(`pending_${blueprint.id}`, { status: "failed" });
                    return;
                }
                updateJob(`pending_${blueprint.id}`, { jobId: data.jobId, status: "done", result_url: data.result_url });
            } catch {
                updateJob(`pending_${blueprint.id}`, { status: "failed" });
                toast.error(t("errors.generationFailed"));
            }
        },
        [productImageUrl, creativeLang, globalResolution, addJob, updateJob, t],
    );

    // ── Generate all selected ─────────────────────────────────────────────────
    async function handleGenerateAll() {
        const selected = blueprints.filter((b) => b.isSelected && b.creativeType !== "ugc_video");
        for (const b of selected) await handleGenerateSingle(b);
    }

    // ─────────────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <p className="text-sm text-muted-foreground">{t("loadingProject")}</p>
            </div>
        );
    }

    const activeStepIndex = STEPS.indexOf(currentStep as (typeof STEPS)[number]);
    const isCreativesStep = currentStep === "creatives" || currentStep === "generating" || currentStep === "results";

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
                    <Eye className="h-5 w-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold tracking-tight truncate">
                        {storeAnalysis?.storeName ?? t("title")}
                    </h1>
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">
                        {storeAnalysis?.storeUrl ?? t("subtitle")}
                    </p>
                </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
                {STEPS.map((step, i) => {
                    const isDone = activeStepIndex > i;
                    const isActive = activeStepIndex === i || (step === "creatives" && isCreativesStep);
                    return (
                        <div key={step} className="flex items-center gap-2">
                            <div
                                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border transition-colors ${
                                    isDone
                                        ? "bg-amber-500 border-amber-500 text-black"
                                        : isActive
                                          ? "border-amber-500 text-amber-400 bg-amber-500/10"
                                          : "border-border text-muted-foreground"
                                }`}
                            >
                                {isDone ? "✓" : i + 1}
                            </div>
                            <span className={`text-xs hidden sm:block ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                {STEP_LABELS[i]}
                            </span>
                            {i < STEPS.length - 1 && (
                                <div className={`h-px w-6 sm:w-12 ${isDone ? "bg-amber-500" : "bg-border"}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Step 1: Store review */}
            {(currentStep === "url_input" || currentStep === "store_review") && (
                <StoreAnalysisForm onConfirm={() => setStep("competitors")} />
            )}

            {/* Step 2: Competitors */}
            {currentStep === "competitors" && (
                <div className="space-y-4">
                    <h2 className="font-semibold">{t("step2.title")}</h2>
                    <CompetitorList onConfirm={() => setStep("creatives")} />
                </div>
            )}

            {/* Step 3+4: Split-screen creatives + results */}
            {isCreativesStep && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6 min-h-[70vh]">
                    {/* ── LEFT PANEL: Blueprints ──────────────────────────── */}
                    <div className="space-y-4 overflow-y-auto lg:pr-3 lg:max-h-[80vh] pb-8">
                        {/* Product image + resolution + language controls */}
                        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {t("productImageSection")}
                            </p>

                            {productImageUrl ? (
                                <div className="flex items-center gap-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={productImageUrl} alt="Product" className="w-12 h-12 object-cover rounded-md border border-border" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground">{t("productImageReady")}</p>
                                        <label className="text-xs text-amber-400 hover:underline cursor-pointer">
                                            {t("changeImage")}
                                            <input type="file" accept="image/*" className="sr-only" onChange={handleGlobalImageUpload} />
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <span className="px-3 py-1.5 rounded border border-border bg-background text-xs hover:bg-muted transition-colors flex items-center gap-1.5">
                                        <Camera className="h-3.5 w-3.5" />
                                        {t("step4.uploadProduct")}
                                    </span>
                                    <span className="text-xs">{t("productImageHint")}</span>
                                    <input type="file" accept="image/*" className="sr-only" onChange={handleGlobalImageUpload} />
                                </label>
                            )}

                            {/* Resolution + Lang inline */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                                    {(["1K", "2K", "4K"] as const).map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setGlobalResolution(r)}
                                            className={cn("px-2.5 py-1 transition-colors", globalResolution === r ? "bg-amber-500 text-black font-medium" : "text-muted-foreground hover:text-foreground")}
                                        >
                                            {r} ({RESOLUTION_COSTS[r]}⚡)
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1">
                                    {(["fr", "en", "de", "es", "it"] as const).map((lang) => (
                                        <button
                                            key={lang}
                                            onClick={() => setCreativeLang(lang)}
                                            title={LANG_MAP[lang]}
                                            className={cn("px-1.5 py-0.5 rounded text-xs transition-colors", creativeLang === lang ? "bg-amber-500/20 text-amber-400 font-medium" : "text-muted-foreground hover:text-foreground")}
                                        >
                                            {LANG_FLAGS[lang]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Blueprints section */}
                        {blueprints.length === 0 ? (
                            isExtracting ? (
                                <div className="space-y-3">
                                    <ProgressMessage messages={["Extracting creative blueprints...", "Analyzing competitor ads...", "Identifying winning formats...", "Building prompts..."]} />
                                    <CardSkeleton count={4} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 py-8 text-center">
                                    <p className="text-sm text-muted-foreground">Ready to extract creative blueprints.</p>
                                    <Button onClick={handleExtract} className="bg-gradient-to-r from-amber-400 to-orange-500 text-black border-none gap-2">
                                        <Zap className="h-4 w-4" />
                                        {t("step3.extractBtn")}
                                    </Button>
                                </div>
                            )
                        ) : (
                            <>
                                {/* Blueprint toolbar */}
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <p className="text-xs text-muted-foreground">
                                        {blueprints.filter((b) => b.isSelected).length} {t("selected")}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={handleExtract} disabled={isExtracting} className="gap-1 text-xs h-7">
                                            <RefreshCw className="h-3 w-3" />
                                            {t("reExtract")}
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleGenerateAll}
                                            disabled={blueprints.filter((b) => b.isSelected && b.creativeType !== "ugc_video").length === 0}
                                            className="bg-gradient-to-r from-amber-400 to-orange-500 text-black border-none gap-1 text-xs h-7"
                                        >
                                            <Zap className="h-3 w-3" />
                                            {t("generateAll")}
                                        </Button>
                                    </div>
                                </div>

                                {/* Blueprint cards */}
                                {blueprints.map((blueprint) => (
                                    <BlueprintCard
                                        key={blueprint.id}
                                        blueprint={blueprint}
                                        resolution={globalResolution}
                                        globalProductImageUrl={productImageUrl}
                                        t={t}
                                        competitors={competitors}
                                        onToggle={() => toggleBlueprint(blueprint.id)}
                                        onPromptChange={(p) => updateBlueprintPrompt(blueprint.id, p)}
                                        onAspectRatioChange={(ar) => updateBlueprintAspectRatio(blueprint.id, ar)}
                                        onGenerate={(customImg) => handleGenerateSingle(blueprint, customImg)}
                                        uploadImage={uploadImage}
                                    />
                                ))}

                                {/* Expand Analysis */}
                                <Button
                                    variant="outline"
                                    onClick={handleExpand}
                                    disabled={isExpanding || expandExhausted}
                                    className="w-full border-dashed gap-2"
                                >
                                    {isExpanding ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" /> {t("expandSearching")}</>
                                    ) : expandExhausted ? (
                                        <>{t("expandEmpty")}</>
                                    ) : (
                                        <><Plus className="h-4 w-4" /> {t("expandAnalysis")}</>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>

                    {/* ── RIGHT PANEL: Generated results ─────────────────── */}
                    <div className="space-y-4 lg:pl-3 lg:border-l lg:border-border overflow-y-auto lg:max-h-[80vh] pb-8 mt-6 lg:mt-0">
                        {generatedJobs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                                <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                                <p className="text-sm text-muted-foreground">{t("emptyResults")}</p>
                                <p className="text-xs text-muted-foreground/60">{t("emptyResultsHint")}</p>
                            </div>
                        ) : (
                            generatedJobs.map((job) => {
                                const blueprint = blueprints.find((b) => b.id === job.blueprintId);
                                return (
                                    <ResultCard
                                        key={job.jobId}
                                        job={job}
                                        blueprint={blueprint}
                                        t={t}
                                        resolution={globalResolution}
                                        onRegenerate={(customImg) => blueprint && handleGenerateSingle(blueprint, customImg)}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Blueprint Card ────────────────────────────────────────────────────────────

function BlueprintCard({
    blueprint,
    resolution,
    globalProductImageUrl,
    t,
    competitors,
    onToggle,
    onPromptChange,
    onAspectRatioChange,
    onGenerate,
    uploadImage,
}: {
    blueprint: CreativeBlueprint;
    resolution: string;
    globalProductImageUrl: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    competitors: any[];
    onToggle: () => void;
    onPromptChange: (p: string) => void;
    onAspectRatioChange: (ar: string) => void;
    onGenerate: (customImg?: string | null) => void;
    uploadImage: (f: File) => Promise<string | null>;
}) {
    const [showPrompt, setShowPrompt] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [customProductImage, setCustomProductImage] = useState<string | null>(null);
    const [isUploadingCustom, setIsUploadingCustom] = useState(false);
    const isUgc = blueprint.creativeType === "ugc_video";
    const perf = blueprint.estimatedPerformance;

    const competitorName =
        blueprint.competitorName ??
        competitors.find((c: { id: string }) => c.id === blueprint.competitorAnalysisId)?.competitorName;

    const sourceStyle =
        SOURCE_STYLES[blueprint.sourceLabel as keyof typeof SOURCE_STYLES] ?? SOURCE_STYLES.market_trend;

    async function handleCustomImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingCustom(true);
        const url = await uploadImage(file);
        setIsUploadingCustom(false);
        if (url) setCustomProductImage(url);
        else toast.error("Upload failed");
    }

    function handleDownloadScript() {
        if (!blueprint.ugcScript) return;
        const blob = new Blob([blueprint.ugcScript], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${blueprint.creativeName.replace(/\s+/g, "_")}_ugc_script.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const activeProductImg = customProductImage ?? globalProductImageUrl;

    return (
        <Card className={cn("border transition-colors", blueprint.isSelected && !isUgc ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card", isUgc && "opacity-75")}>
            <CardContent className="pt-4 pb-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center gap-2 flex-wrap">
                    {!isUgc ? (
                        <button onClick={onToggle} className={cn("shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors", blueprint.isSelected ? "border-amber-500 bg-amber-500" : "border-border")}>
                            {blueprint.isSelected && <Check className="h-2.5 w-2.5 text-black" />}
                        </button>
                    ) : <div className="w-4 h-4 shrink-0" />}

                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full border shrink-0", TYPE_COLORS[blueprint.creativeType] ?? "bg-muted text-muted-foreground")}>
                        {blueprint.creativeType}
                    </span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full border shrink-0", sourceStyle)}>
                        {blueprint.sourceLabel === "cloned_from_competitor" && competitorName
                            ? t("step3.clonedFrom", { name: competitorName })
                            : t("step3.marketTrend")}
                    </span>
                    <p className="font-semibold text-xs flex-1 min-w-0 truncate">{blueprint.creativeName}</p>
                    {isUgc && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{t("step3.comingSoon")}</span>}
                </div>

                {/* Source preview + controls row */}
                <div className="grid grid-cols-2 gap-3">
                    {/* CreativePreview */}
                    <CreativePreview
                        sourceUrl={blueprint.sourceUrl}
                        sourceImageUrl={blueprint.sourceImageUrl}
                        sourcePlatform={blueprint.sourcePlatform}
                        creativeName={blueprint.creativeName}
                    />

                    {/* Controls */}
                    <div className="space-y-2">
                        {/* Collapsible description */}
                        <button onClick={() => setShowDesc((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full">
                            {showDesc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {t("description")}
                        </button>
                        {showDesc && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{blueprint.description}</p>}

                        {/* Prompt editor */}
                        {!isUgc && (
                            <>
                                <button onClick={() => setShowPrompt((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full">
                                    {showPrompt ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    {t("step3.editPrompt")}
                                </button>
                                {showPrompt && (
                                    <textarea
                                        className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs min-h-[70px] resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={blueprint.reproductionPrompt}
                                        onChange={(e) => onPromptChange(e.target.value)}
                                    />
                                )}
                            </>
                        )}

                        {/* Aspect ratio */}
                        {!isUgc && (
                            <select
                                value={blueprint.aspectRatio}
                                onChange={(e) => onAspectRatioChange(e.target.value)}
                                className="text-xs rounded border border-border bg-background px-2 py-1 w-full text-muted-foreground focus:outline-none"
                            >
                                {["9:16", "1:1", "16:9", "4:5"].map((ar) => (
                                    <option key={ar} value={ar}>{ar}</option>
                                ))}
                            </select>
                        )}

                        {/* Performance badges */}
                        {perf && (
                            <div className="flex gap-1 flex-wrap">
                                {perf.hookRate && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">Hook {perf.hookRate}</span>}
                                {perf.engagement && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{perf.engagement}</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer: per-creative image override + generate / UGC download */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                    {!isUgc && (
                        <>
                            {/* Per-creative image override */}
                            <div className="flex items-center gap-1.5">
                                {customProductImage ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={customProductImage} alt="Custom" className="w-6 h-6 rounded object-cover border border-amber-500/40" />
                                        <button
                                            onClick={() => setCustomProductImage(null)}
                                            className="text-[10px] text-amber-400 hover:underline"
                                        >
                                            {t("useGlobal")}
                                        </button>
                                    </>
                                ) : (
                                    <label className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                                        {isUploadingCustom ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                                        <input type="file" accept="image/*" className="sr-only" onChange={handleCustomImageUpload} />
                                    </label>
                                )}
                            </div>

                            {/* Ad Library link */}
                            {competitorName && (
                                <a
                                    href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(competitorName)}&search_type=keyword_unordered`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto"
                                >
                                    {t("step3.viewAds")} <ExternalLink className="h-3 w-3" />
                                </a>
                            )}

                            <Button
                                size="sm"
                                onClick={() => onGenerate(customProductImage)}
                                className="bg-gradient-to-r from-amber-400 to-orange-500 text-black border-none text-xs h-7 gap-1 ml-auto"
                            >
                                <Zap className="h-3 w-3" />
                                {t("generateOne")} ({RESOLUTION_COSTS[resolution]}⚡)
                            </Button>
                        </>
                    )}

                    {/* UGC script download */}
                    {isUgc && blueprint.ugcScript && (
                        <Button variant="outline" size="sm" onClick={handleDownloadScript} className="gap-1.5 text-xs h-7">
                            <Download className="h-3 w-3" />
                            {t("step3.downloadScript")}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({
    job,
    blueprint,
    t,
    resolution,
    onRegenerate,
}: {
    job: GeneratedJob;
    blueprint?: CreativeBlueprint;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    resolution: string;
    onRegenerate: (customImg?: string | null) => void;
}) {
    const CLOUDFRONT = process.env.NEXT_PUBLIC_CLOUDFRONT_URL ?? "";
    const cfUrl = job.result_url
        ? CLOUDFRONT
            ? job.result_url.replace(/^https:\/\/[^/]+\.s3\.[^/]+\.amazonaws\.com/, CLOUDFRONT)
            : job.result_url
        : null;

    if (job.status === "rendering") {
        return (
            <div className="rounded-lg border border-border bg-card p-4 animate-pulse space-y-3">
                <div className="h-48 bg-muted rounded-lg" />
                <ProgressMessage messages={["Génération en cours...", "Modèle IA en cours...", "Presque terminé..."]} />
            </div>
        );
    }

    if (job.status === "failed") {
        return (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                <p className="text-xs text-destructive font-medium">{t("step4.failed")}</p>
                {blueprint && (
                    <Button variant="outline" size="sm" onClick={() => onRegenerate()} className="gap-1.5 text-xs h-7">
                        <RefreshCw className="h-3 w-3" />
                        {t("step5.regenerate")}
                    </Button>
                )}
            </div>
        );
    }

    if (!cfUrl) return null;

    return (
        <div className="rounded-lg border border-border bg-card overflow-hidden space-y-0">
            <div className="relative aspect-square max-h-[300px] bg-muted">
                <Image src={cfUrl} alt={blueprint?.creativeName ?? "Generated creative"} fill className="object-cover" />
                {job.warning === "upload_failed" && (
                    <div className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded bg-amber-500/90 text-black">
                        Temp URL
                    </div>
                )}
            </div>
            <div className="p-3 space-y-2">
                {blueprint && (
                    <p className="text-xs text-muted-foreground">
                        {t("basedOn")}: <span className="text-foreground font-medium">{blueprint.creativeName}</span>
                    </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    <a href={cfUrl} download className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-border hover:bg-muted transition-colors">
                        <Download className="h-3 w-3" />
                        {t("step5.download")}
                    </a>
                    <a
                        href={`https://www.canva.com/design/create?imageUrl=${encodeURIComponent(cfUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-border hover:bg-muted transition-colors"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Canva
                    </a>
                    {blueprint && (
                        <Button variant="outline" size="sm" onClick={() => onRegenerate()} className="gap-1 text-xs h-7 ml-auto">
                            <RefreshCw className="h-3 w-3" />
                            {t("step5.regenerate")}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
