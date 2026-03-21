"use client";

import { useEffect, useCallback, useState, useRef } from "react";
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
    LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { SPARK_PRICING } from "@/config/spark-pricing";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["store_review", "competitors", "creatives"] as const;
const STEP_LABELS = ["Store", "Concurrents", "Créatives & Résultats"];

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
const RESOLUTION_COSTS: Record<string, number> = {
    "1K": SPARK_PRICING.GENERATE_1K,
    "2K": SPARK_PRICING.GENERATE_2K,
    "4K": SPARK_PRICING.GENERATE_4K,
};

const ASPECT_RATIOS = [
    { value: "9:16", emoji: "📱", label: "Story" },
    { value: "1:1", emoji: "⬜", label: "Carré" },
    { value: "16:9", emoji: "🖥️", label: "Paysage" },
    { value: "4:5", emoji: "📸", label: "Feed" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const t = useTranslations("SpyMode");
    const { data: session, update: updateSession } = useSession();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [globalResolution, setGlobalResolution] = useState<"1K" | "2K" | "4K">("1K");
    const [globalLang, setGlobalLang] = useState<"fr" | "en" | "de" | "es" | "it">("fr");
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExpanding, setIsExpanding] = useState(false);
    const [expandExhausted, setExpandExhausted] = useState(false);
    const [visibleCount, setVisibleCount] = useState<number>(() => {
        if (typeof window === "undefined") return SPARK_PRICING.INITIAL_VISIBLE_BLUEPRINTS;
        const saved = localStorage.getItem(`lumina-visible-${projectId}`);
        return saved ? parseInt(saved, 10) : SPARK_PRICING.INITIAL_VISIBLE_BLUEPRINTS;
    });

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
    } = useSpySession();

    // ── Load project from DB ─────────────────────────────────────────────────
    useEffect(() => {
        async function loadProject() {
            try {
                const res = await fetch(`/api/spy/project/${projectId}`);
                if (!res.ok) { router.push("/dashboard/projects"); return; }
                const data = await res.json();

                setStoreAnalysis(data.storeAnalysis);
                // Restore persisted product image from DB
                if (data.storeAnalysis?.productImageUrl) {
                    setProductImageUrl(data.storeAnalysis.productImageUrl);
                }
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
                toast.error("Impossible de charger le projet.");
                router.push("/dashboard/projects");
            } finally {
                setIsLoading(false);
            }
        }
        loadProject();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    // ── Smart polling: only when rendering jobs exist ─────────────────────────
    const hasRenderingJobs = generatedJobs.some(j => j.status === "rendering");
    const generatedJobsRef = useRef(generatedJobs);
    generatedJobsRef.current = generatedJobs;

    // Keep a stable ref so SSE closure can read latest blueprints without stale capture
    const blueprintsRef = useRef(blueprints);
    blueprintsRef.current = blueprints;

    // Persist visibleCount in localStorage so it survives refresh
    useEffect(() => {
        localStorage.setItem(`lumina-visible-${projectId}`, String(visibleCount));
    }, [visibleCount, projectId]);

    useEffect(() => {
        if (!hasRenderingJobs || !projectId) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/spy/project/${projectId}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.jobs && Array.isArray(data.jobs)) {
                    data.jobs.forEach((dbJob: { jobId: string; status: string; result_url: string | null }) => {
                        const current = generatedJobsRef.current.find(j => j.jobId === dbJob.jobId);
                        if (current && current.status === "rendering" && dbJob.status !== "rendering") {
                            updateJob(dbJob.jobId, {
                                status: dbJob.status as "done" | "failed" | "rendering",
                                result_url: dbJob.result_url ?? undefined,
                            });
                            if (dbJob.status === "done") toast.success("Créative générée !");
                            if (dbJob.status === "failed") toast.error("Génération échouée — Spark remboursé");
                        }
                    });
                }
            } catch { /* silent retry */ }
        }, 3000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasRenderingJobs, projectId]);

    // ── SSE with auto-reconnect ───────────────────────────────────────────────
    useEffect(() => {
        if (!session?.user) return;
        let es: EventSource;
        let reconnectTimer: ReturnType<typeof setTimeout>;
        function connect() {
            es = new EventSource("/api/events");
            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "job_update") {
                        updateJob(data.jobId, { status: data.status, result_url: data.result_url, warning: data.warning });
                        if (data.status === "done") toast.success("Créative générée !");
                        else if (data.status === "failed") toast.error(t("errors.generationFailed"));
                    }
                    // FIX 1: Incrementally stream blueprints as each competitor finishes
                    if (data.type === "creatives_extracted" && Array.isArray(data.blueprints) && data.blueprints.length > 0) {
                        const existingIds = new Set(blueprintsRef.current.map((b: CreativeBlueprint) => b.id));
                        const incoming = (data.blueprints as CreativeBlueprint[]).filter((b) => !existingIds.has(b.id));
                        if (incoming.length > 0) {
                            setBlueprints([...blueprintsRef.current, ...incoming]);
                            toast.success(`${incoming.length} blueprints extraits pour ${data.competitorName}`);
                        }
                    }
                } catch {}
            };
            es.onerror = () => {
                es.close();
                reconnectTimer = setTimeout(connect, 2000);
            };
        }
        connect();
        return () => { es?.close(); clearTimeout(reconnectTimer); };
    }, [session, updateJob, t]);

    // ── Polling: pick up new blueprints during extraction (works on Vercel) ───
    useEffect(() => {
        if (!isExtracting || !storeAnalysis?.id) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/spy/project/${storeAnalysis.id}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.blueprints && Array.isArray(data.blueprints)) {
                    const existingIds = new Set(blueprintsRef.current.map((b: CreativeBlueprint) => b.id));
                    const newOnes = data.blueprints.filter((b: CreativeBlueprint) => !existingIds.has(b.id));
                    if (newOnes.length > 0) {
                        const cMap = Object.fromEntries(competitors.map((c) => [c.id, c.competitorName]));
                        const withNames = newOnes.map((b: CreativeBlueprint) => ({
                            ...b,
                            competitorName: b.competitorAnalysisId
                                ? cMap[b.competitorAnalysisId]
                                : undefined,
                        }));
                        setBlueprints([...blueprintsRef.current, ...withNames]);
                    }
                }
            } catch { /* silent */ }
        }, 3000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isExtracting, storeAnalysis?.id]);

    // ── Upload helper ─────────────────────────────────────────────────────────
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
        if (url) {
            setProductImageUrl(url);
            toast.success(t("productImageReady"));
            // Persist in DB
            if (storeAnalysis?.id) {
                fetch(`/api/spy/project/${storeAnalysis.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productImageUrl: url }),
                }).catch(() => {});
            }
        } else {
            toast.error("Upload échoué. Réessayez.");
        }
    }

    // ── Extract creatives — fire-and-forget (polling picks up results) ─────────
    function handleExtract() {
        if (!storeAnalysis?.id) return;
        const selectedIds = competitors
            .filter((c) => c.isSelected && !c.id.startsWith("manual_"))
            .map((c) => c.id);
        if (selectedIds.length === 0) { toast.error("Aucun concurrent valide sélectionné."); return; }

        setIsExtracting(true);
        setBlueprints([]);
        setVisibleCount(SPARK_PRICING.INITIAL_VISIBLE_BLUEPRINTS);
        setExpandExhausted(false);

        // Fire-and-forget — polling useEffect picks up results every 3s
        fetch("/api/spy/extract-creatives", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                storeAnalysisId: storeAnalysis.id,
                competitorIds: selectedIds,
                targetLanguage: globalLang,
            }),
        })
            .then(async (res) => {
                const data = await res.json();
                if (data.status === "done" && Array.isArray(data.blueprints)) {
                    // Final reconciliation — APPEND only missing (polling may have added some already)
                    const existingIds = new Set(blueprintsRef.current.map((b) => b.id));
                    const cMap = Object.fromEntries(competitors.map((c) => [c.id, c.competitorName]));
                    const missing = (data.blueprints as CreativeBlueprint[])
                        .filter((b) => !existingIds.has(b.id))
                        .map((b) => ({
                            ...b,
                            competitorName: b.competitorAnalysisId
                                ? cMap[b.competitorAnalysisId]
                                : undefined,
                        }));
                    setBlueprints([...blueprintsRef.current, ...missing]);
                } else {
                    toast.error("Extraction échouée.");
                }
            })
            .catch(() => { toast.error("Extraction échouée. Réessayez."); })
            .finally(() => { setIsExtracting(false); });
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
                    targetLanguage: globalLang,
                }),
            });

            if (res.status === 402) {
                toast.error(`Pas assez de Sparks pour élargir l'analyse (${SPARK_PRICING.EXPAND_ANALYSIS} ⚡ requis).`);
                return;
            }

            const data = await res.json();
            if (data.status === "done" && Array.isArray(data.blueprints)) {
                if (data.blueprints.length === 0) {
                    setExpandExhausted(true);
                    toast.info(t("expandEmpty"));
                } else {
                    // APPEND only — never replace, never reorder existing blueprints
                    const current = blueprintsRef.current;
                    const existingIds = new Set(current.map((b) => b.id));
                    const existingImages = new Set(
                        current.map((b) => b.sourceImageUrl).filter(Boolean),
                    );
                    const cMap = Object.fromEntries(competitors.map((c) => [c.id, c.competitorName]));
                    const newOnes = (data.blueprints as CreativeBlueprint[])
                        .filter(
                            (b) =>
                                !existingIds.has(b.id) &&
                                (!b.sourceImageUrl || !existingImages.has(b.sourceImageUrl)),
                        )
                        .map((b) => ({
                            ...b,
                            competitorName: b.competitorAnalysisId
                                ? cMap[b.competitorAnalysisId]
                                : undefined,
                        }));

                    if (newOnes.length === 0) {
                        setExpandExhausted(true);
                        toast.info("Aucune nouvelle créative unique trouvée.");
                    } else {
                        setBlueprints([...current, ...newOnes]);
                        toast.success(
                            `${newOnes.length} nouvelle${newOnes.length > 1 ? "s" : ""} créative${newOnes.length > 1 ? "s" : ""} ajoutée${newOnes.length > 1 ? "s" : ""}`,
                        );
                    }
                }
            }
        } catch {
            toast.error("Expansion échouée.");
        } finally {
            setIsExpanding(false);
        }
    }

    // ── Generate single ───────────────────────────────────────────────────────
    const handleGenerateSingle = useCallback(
        async (blueprint: CreativeBlueprint, customImgUrl?: string | null, perCreativeLang?: string | null) => {
            const imgUrl = customImgUrl ?? productImageUrl ?? null;
            const langToUse = perCreativeLang ?? globalLang;

            addJob({ jobId: `pending_${blueprint.id}`, blueprintId: blueprint.id, result_url: "", status: "rendering" });

            try {
                const res = await fetch("/api/spy/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                            blueprintId: blueprint.id,
                            productImageUrl: imgUrl ?? undefined,
                            resolution: globalResolution,
                            language: langToUse,
                            aspectRatio: blueprint.aspectRatio,
                        }),
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
                await updateSession(); // Refresh credits counter instantly after spark deduction
            } catch {
                updateJob(`pending_${blueprint.id}`, { status: "failed" });
                toast.error(t("errors.generationFailed"));
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [productImageUrl, globalLang, globalResolution, addJob, updateJob, t, updateSession],
    );

    async function handleGenerateAll() {
        const selected = blueprints.filter((b) => b.isSelected && b.creativeType !== "ugc_video");
        for (const b of selected) await handleGenerateSingle(b);
    }

    // ── Show more blueprints (costs Sparks) ───────────────────────────────────
    async function handleShowMore() {
        try {
            const res = await fetch("/api/spy/deduct-sparks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "SHOW_MORE_RESULTS",
                    cost: SPARK_PRICING.SHOW_MORE_RESULTS,
                }),
            });
            if (!res.ok) {
                if (res.status === 402) {
                    toast.error("Pas assez de Sparks — rechargez votre compte.");
                    return;
                }
                throw new Error("deduct failed");
            }
            setVisibleCount((v) => v + SPARK_PRICING.SHOW_MORE_BATCH_SIZE);
            await updateSession(); // Refresh credits counter instantly
            toast.success(`+${SPARK_PRICING.SHOW_MORE_BATCH_SIZE} créatives débloquées`);
        } catch {
            toast.error("Erreur lors du déverrouillage.");
        }
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
    const selectedCount = blueprints.filter(b => b.isSelected && b.creativeType !== "ugc_video").length;

    return (
        <div className="max-w-7xl mx-auto space-y-4">
            {/* ── Header ────────────────────────────────────────── */}
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
                {isCreativesStep && generatedJobs.filter(j => j.status === "done").length > 0 && (
                    <a
                        href={`/dashboard/projects/${projectId}/overview`}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors shrink-0"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Vue grille
                    </a>
                )}
            </div>

            {/* ── Step indicator ────────────────────────────────── */}
            <div className="flex items-center gap-2">
                {STEPS.map((step, i) => {
                    const isDone = activeStepIndex > i;
                    const isActive = activeStepIndex === i || (step === "creatives" && isCreativesStep);
                    return (
                        <div key={step} className="flex items-center gap-2">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border transition-colors ${
                                isDone ? "bg-amber-500 border-amber-500 text-black"
                                : isActive ? "border-amber-500 text-amber-400 bg-amber-500/10"
                                : "border-border text-muted-foreground"
                            }`}>
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

            {/* ── Step 1: Store review ──────────────────────────── */}
            {(currentStep === "url_input" || currentStep === "store_review") && (
                <StoreAnalysisForm onConfirm={() => setStep("competitors")} />
            )}

            {/* ── Step 2: Competitors ───────────────────────────── */}
            {currentStep === "competitors" && (
                <div className="space-y-4">
                    <h2 className="font-semibold">{t("step2.title")}</h2>
                    <CompetitorList onConfirm={() => setStep("creatives")} />
                </div>
            )}

            {/* ── Step 3+4: Unified rows ────────────────────────── */}
            {isCreativesStep && (
                <div className="space-y-4 pb-8">
                    {/* Sticky controls bar */}
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border border-border rounded-xl p-4 space-y-3">
                        <InfoTooltip
                            title="Image produit"
                            content="Uploadez une image globale utilisée pour toutes vos créatives. Vous pouvez définir une image spécifique par créative — elle sera prioritaire."
                            storageKey="tooltip_product_image"
                        />

                        {/* Product image */}
                        {productImageUrl ? (
                            <div className="flex items-center gap-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={productImageUrl} alt="Product" className="w-10 h-10 object-cover rounded-md border border-border" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">{t("productImageReady")}</p>
                                    <label className="text-xs text-amber-400 hover:underline cursor-pointer">
                                        {t("changeImage")}
                                        <input type="file" accept="image/*" className="sr-only" onChange={handleGlobalImageUpload} />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <span className="px-3 py-1.5 rounded-lg border border-dashed border-border bg-background text-xs hover:bg-muted transition-colors flex items-center gap-1.5">
                                    <Camera className="h-3.5 w-3.5" />
                                    {t("step4.uploadProduct")}
                                </span>
                                <span className="text-xs text-muted-foreground">{t("productImageHint")}</span>
                                <input type="file" accept="image/*" className="sr-only" onChange={handleGlobalImageUpload} />
                            </label>
                        )}

                        {/* Controls row */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Resolution */}
                            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                                {(["1K", "2K", "4K"] as const).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setGlobalResolution(r)}
                                        className={cn("px-2.5 py-1.5 transition-colors", globalResolution === r ? "bg-amber-500 text-black font-medium" : "text-muted-foreground hover:text-foreground")}
                                    >
                                        {r} ({RESOLUTION_COSTS[r]}⚡)
                                    </button>
                                ))}
                            </div>

                            {/* Language */}
                            <div className="flex items-center gap-1">
                                {(["fr", "en", "de", "es", "it"] as const).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => setGlobalLang(lang)}
                                        title={LANG_MAP[lang]}
                                        className={cn("px-1.5 py-0.5 rounded text-sm transition-colors", globalLang === lang ? "bg-amber-500/20 text-amber-400 font-medium" : "text-muted-foreground/60 hover:text-muted-foreground")}
                                    >
                                        {LANG_FLAGS[lang]}
                                    </button>
                                ))}
                            </div>

                            {/* Actions */}
                            {blueprints.length > 0 && (
                                <div className="flex gap-2 ml-auto">
                                    <Button variant="outline" size="sm" onClick={handleExtract} disabled={isExtracting} className="gap-1 text-xs h-7">
                                        <RefreshCw className="h-3 w-3" />
                                        {t("reExtract")}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleGenerateAll}
                                        disabled={selectedCount === 0}
                                        className="bg-gradient-to-r from-amber-400 to-orange-500 text-black border-none gap-1 text-xs h-7"
                                    >
                                        <Zap className="h-3 w-3" />
                                        {t("generateAll")} ({selectedCount})
                                    </Button>
                                </div>
                            )}
                        </div>
                        {blueprints.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {blueprints.filter(b => b.isSelected).length} {t("selected")}
                            </p>
                        )}
                    </div>

                    {/* Extraction progress banner — shows while extracting even after first blueprints arrive */}
                    {isExtracting && (
                        <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                            <Loader2 className="h-5 w-5 animate-spin text-amber-500 shrink-0" />
                            <div>
                                <p className="text-sm font-medium">Analyse des publicités concurrentes...</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {blueprints.length > 0
                                        ? `${blueprints.length} créative${blueprints.length > 1 ? "s" : ""} trouvée${blueprints.length > 1 ? "s" : ""} · Les résultats apparaissent au fur et à mesure`
                                        : "Les résultats apparaissent au fur et à mesure"}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Empty / loading state (only when no blueprints yet) */}
                    {blueprints.length === 0 && (
                        isExtracting ? (
                            <div className="space-y-3 pt-2">
                                <ProgressMessage messages={["Récupération des vraies publicités Meta...", "Analyse des créatives avec Gemini...", "Identification des formats gagnants...", "Construction des prompts de reproduction..."]} />
                                <CardSkeleton count={4} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 py-16 text-center">
                                <p className="text-sm text-muted-foreground">Prêt à extraire les blueprints créatifs.</p>
                                <Button onClick={handleExtract} className="bg-gradient-to-r from-amber-400 to-orange-500 text-black border-none gap-2">
                                    <Zap className="h-4 w-4" />
                                    {t("step3.extractBtn")}
                                </Button>
                            </div>
                        )
                    )}

                    {/* Unified rows: blueprint aligned with its result */}
                    {blueprints.slice(0, visibleCount).map((blueprint) => {
                        const job = generatedJobs.find(j => j.blueprintId === blueprint.id);
                        const hasResult = !!job && (job.status === "done" || job.status === "rendering");
                        return (
                            <div key={blueprint.id} className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                                <BlueprintCard
                                    blueprint={blueprint}
                                    resolution={globalResolution}
                                    globalProductImageUrl={productImageUrl}
                                    globalLang={globalLang}
                                    storeAnalysis={storeAnalysis}
                                    t={t}
                                    competitors={competitors}
                                    hasResult={hasResult}
                                    onToggle={() => toggleBlueprint(blueprint.id)}
                                    onPromptChange={(p) => updateBlueprintPrompt(blueprint.id, p)}
                                    onAspectRatioChange={(ar) => updateBlueprintAspectRatio(blueprint.id, ar)}
                                    onGenerate={(customImg, lang) => handleGenerateSingle(blueprint, customImg, lang)}
                                    uploadImage={uploadImage}
                                />
                                <div className="min-h-[200px]">
                                    {job ? (
                                        <ResultCard
                                            job={job}
                                            blueprint={blueprint}
                                            t={t}
                                            resolution={globalResolution}
                                            onRegenerate={(customImg) => handleGenerateSingle(blueprint, customImg)}
                                        />
                                    ) : (
                                        <div className="h-full min-h-[200px] rounded-xl border border-dashed border-border/40 bg-muted/5 flex flex-col items-center justify-center text-center p-6">
                                            {blueprint.creativeType === "ugc_video" ? (
                                                <p className="text-xs text-muted-foreground">Vidéo UGC — bientôt disponible</p>
                                            ) : (
                                                <>
                                                    <ImageIcon className="h-8 w-8 text-muted-foreground/15 mb-2" />
                                                    <p className="text-xs text-muted-foreground/50">
                                                        Cliquez sur &quot;Générer&quot; pour voir le résultat ici
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Expansion loading banner */}
                    {isExpanding && (
                        <div className="flex items-center gap-3 p-4 rounded-lg border border-purple-500/20 bg-purple-500/5">
                            <Loader2 className="h-5 w-5 animate-spin text-purple-400 shrink-0" />
                            <div>
                                <p className="text-sm font-medium">Recherche de nouvelles créatives...</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Les publicités Meta sont analysées pour trouver des formats encore inexploités.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* "Voir plus" — costs Sparks to unlock more blueprints */}
                    {blueprints.length > visibleCount && (
                        <div className="flex flex-col items-center gap-2 py-4">
                            <p className="text-xs text-muted-foreground">
                                {blueprints.length - visibleCount} créative{blueprints.length - visibleCount > 1 ? "s" : ""} supplémentaire{blueprints.length - visibleCount > 1 ? "s" : ""} disponible{blueprints.length - visibleCount > 1 ? "s" : ""}
                            </p>
                            <button
                                onClick={handleShowMore}
                                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Voir plus ({SPARK_PRICING.SHOW_MORE_RESULTS} ⚡)
                            </button>
                        </div>
                    )}

                    {/* Expand button — shows Spark cost */}
                    {blueprints.length > 0 && (
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
                                <><Plus className="h-4 w-4" /> {t("expandAnalysis")} ({SPARK_PRICING.EXPAND_ANALYSIS} ⚡)</>
                            )}
                        </Button>
                    )}
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
    globalLang,
    storeAnalysis,
    t,
    competitors,
    hasResult,
    onToggle,
    onPromptChange,
    onAspectRatioChange,
    onGenerate,
    uploadImage,
}: {
    blueprint: CreativeBlueprint;
    resolution: string;
    globalProductImageUrl: string | null;
    globalLang: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeAnalysis: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    competitors: any[];
    hasResult: boolean;
    onToggle: () => void;
    onPromptChange: (p: string) => void;
    onAspectRatioChange: (ar: string) => void;
    onGenerate: (customImg?: string | null, lang?: string | null) => void;
    uploadImage: (f: File) => Promise<string | null>;
}) {
    const [showPrompt, setShowPrompt] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [customProductImage, setCustomProductImage] = useState<string | null>(
        blueprint.customProductImageUrl ?? null
    );
    const [isUploadingCustom, setIsUploadingCustom] = useState(false);
    const [perCreativeLang, setPerCreativeLang] = useState<string | null>(null);
    const [allowNoProduct, setAllowNoProduct] = useState(false);

    const isUgc = blueprint.creativeType === "ugc_video";
    const perf = blueprint.estimatedPerformance;

    const competitorName =
        blueprint.competitorName ??
        competitors.find((c: { id: string }) => c.id === blueprint.competitorAnalysisId)?.competitorName;

    const sourceStyle =
        SOURCE_STYLES[blueprint.sourceLabel as keyof typeof SOURCE_STYLES] ?? SOURCE_STYLES.market_trend;

    const activeProductImg = customProductImage ?? globalProductImageUrl;
    const canGenerate = !!activeProductImg || allowNoProduct;
    const langToUse = perCreativeLang ?? globalLang;

    async function handleCustomImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingCustom(true);
        const url = await uploadImage(file);
        setIsUploadingCustom(false);
        if (url) {
            setCustomProductImage(url);
            // Persist per-creative image
            fetch(`/api/spy/blueprint/${blueprint.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customProductImageUrl: url }),
            }).catch(() => {});
        } else {
            toast.error("Upload échoué");
        }
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

    // B8: Better Meta Ads search query
    const metaSearchQuery = [competitorName, storeAnalysis?.productCategory].filter(Boolean).join(" ");
    const metaUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(metaSearchQuery)}&search_type=keyword_unordered`;

    return (
        <Card className={cn("border transition-colors", blueprint.isSelected && !isUgc ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card", isUgc && "opacity-75")}>
            <CardContent className="p-4 space-y-3">
                {/* 1. Header */}
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

                {/* 2. Source preview — full width */}
                <CreativePreview
                    sourceUrl={blueprint.sourceUrl}
                    sourceImageUrl={blueprint.sourceImageUrl}
                    sourcePlatform={blueprint.sourcePlatform}
                    creativeName={blueprint.creativeName}
                />

                {/* 3. Collapsible details */}
                <div className="space-y-2">
                    <button onClick={() => setShowDesc(v => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full">
                        {showDesc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {t("description")}
                    </button>
                    {showDesc && <p className="text-xs text-muted-foreground leading-relaxed">{blueprint.description}</p>}

                    {!isUgc && (
                        <>
                            <button onClick={() => setShowPrompt(v => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full">
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

                    {/* C3: Emoji format selector + C4: per-creative language */}
                    {!isUgc && (
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Aspect ratio pills */}
                            <div className="flex gap-1">
                                {ASPECT_RATIOS.map((ar) => (
                                    <button
                                        key={ar.value}
                                        onClick={() => onAspectRatioChange(ar.value)}
                                        title={ar.label}
                                        className={cn(
                                            "text-xs px-2 py-1 rounded-md border transition-colors",
                                            blueprint.aspectRatio === ar.value
                                                ? "border-amber-500 bg-amber-500/10 text-amber-400"
                                                : "border-border text-muted-foreground hover:border-amber-500/30"
                                        )}
                                    >
                                        {ar.emoji} {ar.value}
                                    </button>
                                ))}
                            </div>

                            {/* Per-creative language */}
                            <div className="flex gap-0.5 ml-auto">
                                {(["fr", "en", "de", "es", "it"] as const).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => setPerCreativeLang(perCreativeLang === lang ? null : lang)}
                                        title={lang === perCreativeLang ? "Utiliser la langue globale" : LANG_MAP[lang]}
                                        className={cn(
                                            "text-xs px-1 py-0.5 rounded transition-colors",
                                            perCreativeLang === lang ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"
                                        )}
                                    >
                                        {LANG_FLAGS[lang]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Performance badges */}
                    {perf && (
                        <div className="flex gap-1 flex-wrap">
                            {perf.hookRate && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">Hook {perf.hookRate}</span>}
                            {perf.engagement && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{perf.engagement}</span>}
                        </div>
                    )}
                </div>

                {/* 4. Product image slot — always visible */}
                {!isUgc && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/10 border border-border/50">
                        {activeProductImg ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={activeProductImg} alt="Product" className="w-10 h-10 rounded-md object-cover border border-border shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-muted-foreground">
                                        {customProductImage ? t("customImage") : t("productImageReady")}
                                    </p>
                                    <div className="flex gap-2 mt-0.5">
                                        <label className="text-[10px] text-amber-400 hover:underline cursor-pointer">
                                            {t("changeImage")}
                                            <input type="file" accept="image/*" className="sr-only" onChange={handleCustomImageUpload} />
                                        </label>
                                        {customProductImage && (
                                            <button
                                                onClick={() => {
                                                    setCustomProductImage(null);
                                                    fetch(`/api/spy/blueprint/${blueprint.id}`, {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ customProductImageUrl: null }),
                                                    }).catch(() => {});
                                                }}
                                                className="text-[10px] text-muted-foreground hover:text-foreground"
                                            >
                                                {t("useGlobal")}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <label className="flex items-center gap-2 cursor-pointer w-full p-0.5">
                                <div className="w-10 h-10 rounded-md border border-dashed border-border flex items-center justify-center bg-muted/5 shrink-0">
                                    {isUploadingCustom
                                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                                        : <Camera className="h-4 w-4 text-muted-foreground/40" />
                                    }
                                </div>
                                <span className="text-xs text-muted-foreground">{t("customImage")}</span>
                                <input type="file" accept="image/*" className="sr-only" onChange={handleCustomImageUpload} />
                            </label>
                        )}
                    </div>
                )}

                {/* C1: "Generate without product" checkbox when no image */}
                {!isUgc && !activeProductImg && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={allowNoProduct}
                            onChange={(e) => setAllowNoProduct(e.target.checked)}
                            className="rounded border-border accent-amber-500"
                        />
                        Générer sans image produit (scène seule)
                    </label>
                )}

                {/* 5. Action — FIX 4: show Générer only before a result exists */}
                {!isUgc && !hasResult && (
                    <div className="space-y-1.5">
                        {competitorName && (
                            <a
                                href={metaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground justify-end transition-colors"
                            >
                                {t("step3.viewAds")} <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                        <Button
                            onClick={() => onGenerate(customProductImage, perCreativeLang)}
                            disabled={!canGenerate}
                            className={cn(
                                "w-full gap-2 h-9",
                                canGenerate
                                    ? "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none"
                                    : "bg-muted text-muted-foreground cursor-not-allowed border-none"
                            )}
                        >
                            <Zap className="h-3.5 w-3.5" />
                            Générer ({RESOLUTION_COSTS[resolution]}⚡)
                            {perCreativeLang && <span className="text-xs opacity-75">· {LANG_FLAGS[perCreativeLang]}</span>}
                        </Button>
                    </div>
                )}

                {/* UGC script download */}
                {isUgc && blueprint.ugcScript && (
                    <Button variant="outline" size="sm" onClick={handleDownloadScript} className="gap-1.5 text-xs h-7 w-full">
                        <Download className="h-3 w-3" />
                        {t("step3.downloadScript")}
                    </Button>
                )}
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
            <div className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-3">
                <div className="h-64 bg-muted rounded-lg" />
                <ProgressMessage messages={["Génération en cours...", "Modèle IA actif...", "Presque terminé..."]} />
            </div>
        );
    }

    if (job.status === "failed") {
        return (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
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

    // B2: Proper download filename + target="_blank"
    const downloadName = `lumina-${(blueprint?.creativeName ?? "creative").replace(/\s+/g, "-").toLowerCase()}.png`;

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={cfUrl}
                alt={blueprint?.creativeName ?? "Generated creative"}
                className="w-full object-cover"
                style={{ maxHeight: "360px" }}
            />
            {job.warning === "upload_failed" && (
                <div className="px-3 pt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/90 text-black">Temp URL</span>
                </div>
            )}
            <div className="p-3 space-y-2">
                {blueprint && (
                    <p className="text-xs text-muted-foreground">
                        {t("basedOn")}: <span className="text-foreground font-medium">{blueprint.creativeName}</span>
                    </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* B2: Fixed download */}
                    <a
                        href={cfUrl}
                        download={downloadName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                        <Download className="h-3 w-3" />
                        {t("step5.download")}
                    </a>
                    {/* B1: Open image directly (Canva alternative) */}
                    <a
                        href={cfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Ouvrir
                    </a>
                    {blueprint && (
                        <Button variant="outline" size="sm" onClick={() => onRegenerate()} className="gap-1 text-xs h-7 ml-auto">
                            <RefreshCw className="h-3 w-3" />
                            {t("step5.regenerate")} ({RESOLUTION_COSTS[resolution]}⚡)
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
