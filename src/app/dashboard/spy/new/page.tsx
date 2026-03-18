"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye } from "lucide-react";

import { useSpySession, type CreativeBlueprint } from "@/hooks/useSpySession";
import { StoreAnalysisForm } from "@/components/spy/StoreAnalysisForm";
import { CompetitorList } from "@/components/spy/CompetitorList";
import { CreativeGallery } from "@/components/spy/CreativeGallery";
import { ResultsGrid } from "@/components/spy/ResultsGrid";

const STEPS = ["store_review", "competitors", "creatives", "results"] as const;
const STEP_LABELS = ["Store", "Competitors", "Creatives", "Results"];

export default function SpyNewPage() {
    const t = useTranslations("SpyMode");
    const { data: session } = useSession();
    const router = useRouter();
    const {
        currentStep,
        setStep,
        storeAnalysis,
        productImageUrl,
        setProductImageUrl,
        addJob,
        updateJob,
        reset,
    } = useSpySession();

    const isGenerating = useSpySession((s) =>
        s.generatedJobs.some((j) => j.status === "rendering"),
    );

    // SSE connection
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!session?.user) return;
        const es = new EventSource("/api/events");
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "job_update") {
                    updateJob(data.jobId, {
                        status: data.status,
                        result_url: data.result_url,
                        warning: data.warning,
                    });
                    if (data.status === "done") {
                        toast.success("Creative generated!");
                    } else if (data.status === "failed") {
                        toast.error(t("errors.generationFailed"));
                    }
                }
            } catch {
                // ignore parse errors
            }
        };

        return () => es.close();
    }, [session, updateJob, t]);

    // Product image upload — presigned URL flow
    async function handleProductImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Step 1: Get presigned URL
            const presignRes = await fetch("/api/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, contentType: file.type }),
            });
            if (!presignRes.ok) throw new Error("presign failed");
            const { presignedUrl, publicUrl } = await presignRes.json();

            // Step 2: PUT file directly to S3
            const uploadRes = await fetch(presignedUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
            });
            if (!uploadRes.ok) throw new Error("s3 upload failed");

            setProductImageUrl(publicUrl);
            toast.success("Product image uploaded.");
        } catch {
            toast.error("Upload failed. Please try again.");
        }
    }

    // Called by StoreAnalysisForm once store is confirmed — redirect to project URL
    function handleStoreConfirm() {
        if (storeAnalysis?.id) {
            router.replace(`/dashboard/spy/${storeAnalysis.id}`);
        } else {
            setStep("competitors");
        }
    }

    const handleGenerate = useCallback(
        async (selectedBlueprints: CreativeBlueprint[], resolution: string) => {
            if (!productImageUrl) {
                toast.error("Please upload your product image first.");
                return;
            }

            setStep("generating");

            for (const blueprint of selectedBlueprints) {
                addJob({
                    jobId: `pending_${blueprint.id}`,
                    blueprintId: blueprint.id,
                    result_url: "",
                    status: "rendering",
                });

                try {
                    const res = await fetch("/api/spy/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            blueprintId: blueprint.id,
                            productImageUrl,
                            resolution,
                        }),
                    });

                    const data = await res.json();

                    if (res.status === 402) {
                        toast.error(t("errors.insufficientSparks"));
                        updateJob(`pending_${blueprint.id}`, { status: "failed" });
                        continue;
                    }

                    if (!res.ok || data.error) {
                        toast.error(t("errors.generationFailed"));
                        updateJob(`pending_${blueprint.id}`, { status: "failed" });
                        continue;
                    }

                    updateJob(`pending_${blueprint.id}`, {
                        jobId: data.jobId,
                        status: "done",
                        result_url: data.result_url,
                    });
                } catch {
                    updateJob(`pending_${blueprint.id}`, { status: "failed" });
                    toast.error(t("errors.generationFailed"));
                }
            }

            setStep("results");
        },
        [productImageUrl, addJob, updateJob, setStep, t],
    );

    const handleRegenerate = useCallback(
        async (blueprintId: string, imgUrl: string, resolution: string) => {
            addJob({
                jobId: `regen_${blueprintId}_${Date.now()}`,
                blueprintId,
                result_url: "",
                status: "rendering",
            });

            const res = await fetch("/api/spy/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blueprintId, productImageUrl: imgUrl, resolution }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                toast.error(
                    res.status === 402
                        ? t("errors.insufficientSparks")
                        : t("errors.generationFailed"),
                );
            }
        },
        [addJob, t],
    );

    const activeStepIndex = STEPS.indexOf(currentStep as (typeof STEPS)[number]);

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
                    <Eye className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">{t("subtitle")}</p>
                </div>
            </div>

            {/* Step indicator */}
            {currentStep !== "url_input" && (
                <div className="flex items-center gap-2">
                    {STEPS.map((step, i) => {
                        const isDone = activeStepIndex > i;
                        const isActive = activeStepIndex === i;
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
                                <span
                                    className={`text-xs hidden sm:block ${
                                        isActive ? "text-foreground font-medium" : "text-muted-foreground"
                                    }`}
                                >
                                    {STEP_LABELS[i]}
                                </span>
                                {i < STEPS.length - 1 && (
                                    <div
                                        className={`h-px w-6 sm:w-12 ${isDone ? "bg-amber-500" : "bg-border"}`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Step 1: URL input + store review */}
            {(currentStep === "url_input" || currentStep === "store_review") && (
                <StoreAnalysisForm onConfirm={handleStoreConfirm} />
            )}

            {/* Step 2: Competitors */}
            {currentStep === "competitors" && (
                <div className="space-y-4">
                    <h2 className="font-semibold">{t("step2.title")}</h2>
                    <CompetitorList onConfirm={() => setStep("creatives")} />
                </div>
            )}

            {/* Step 3: Creatives + product image upload */}
            {currentStep === "creatives" && (
                <div className="space-y-6">
                    <h2 className="font-semibold">{t("step3.title")}</h2>

                    {/* Product image upload */}
                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
                        <p className="text-sm font-medium mb-2">{t("step4.uploadProduct")}</p>
                        {productImageUrl ? (
                            <div className="flex items-center gap-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={productImageUrl}
                                    alt="Product"
                                    className="w-16 h-16 object-cover rounded-md border border-border"
                                />
                                <div>
                                    <p className="text-xs text-muted-foreground">Product image ready</p>
                                    <label className="text-xs text-amber-400 hover:underline cursor-pointer">
                                        Change image
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="sr-only"
                                            onChange={handleProductImageUpload}
                                        />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                                <span className="px-3 py-1.5 rounded border border-border bg-background text-xs hover:bg-muted transition-colors">
                                    Choose file
                                </span>
                                <span className="text-xs">PNG, JPG up to 10MB</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={handleProductImageUpload}
                                />
                            </label>
                        )}
                    </div>

                    <CreativeGallery onGenerate={handleGenerate} isGenerating={isGenerating} />
                </div>
            )}

            {/* Step 4: Generating */}
            {currentStep === "generating" && (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <div className="relative">
                        <div className="absolute inset-0 w-16 h-16 rounded-full bg-amber-500/10 blur-[30px]" />
                        <div className="relative w-14 h-14 rounded-2xl border border-amber-500/20 bg-card flex items-center justify-center">
                            <Eye className="h-7 w-7 text-amber-400 animate-pulse" />
                        </div>
                    </div>
                    <h2 className="font-semibold text-lg">{t("step4.title")}</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        {t("step4.generating")} This may take 15–30 seconds per creative.
                    </p>
                </div>
            )}

            {/* Step 5: Results */}
            {currentStep === "results" && (
                <div className="space-y-4">
                    <h2 className="font-semibold">{t("step5.title")}</h2>
                    <ResultsGrid
                        onRegenerate={handleRegenerate}
                        onNewSpy={() => {
                            reset();
                            router.push("/dashboard/spy");
                        }}
                    />
                </div>
            )}
        </div>
    );
}
