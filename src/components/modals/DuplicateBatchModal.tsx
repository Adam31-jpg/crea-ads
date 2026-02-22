'use client';

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeSelector } from "@/components/shared/studio/ThemeSelector";
import { THEMES, ThemePreviewSVG } from "@/app/dashboard/studio/page";
import { GENERATION_CONFIG } from "@/config/generation.config";
import { Loader2, Sparkles, Smartphone, Square, Monitor, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Batch } from "@/components/dashboard/batch-card";

interface DuplicateBatchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceBatch: Batch | null;
}

export function DuplicateBatchModal({ open, onOpenChange, sourceBatch }: DuplicateBatchModalProps) {
    const t = useTranslations("Dashboard.duplicateModal");
    const tToasts = useTranslations("Dashboard.studio.toasts");
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState<"style" | "output">("style");

    const formatOptions = [
        { value: "1080x1920", label: "Story / Reels", icon: Smartphone },
        { value: "1080x1080", label: "Carré", icon: Square },
        { value: "1920x1080", label: "Paysage", icon: Monitor },
    ];

    // Local duplicated state
    const [form, setForm] = useState({
        projectName: "",
        theme: "luxe-sombre",
        accentColor: "#F59E0B",
        format: "1080x1920",
        durationSec: 6,
    });

    // Hydrate form when modal opens with a valid batch
    // We do this instead of relying solely on initial state to catch dynamic prop changes
    useState(() => {
        if (sourceBatch) {
            setForm({
                projectName: `${sourceBatch.project_name} (copie)`,
                theme: (sourceBatch.input_data.theme as string) || "luxe-sombre",
                accentColor: (sourceBatch.input_data.accentColor as string) || "#F59E0B",
                format: (sourceBatch.input_data.format as string) || "1080x1920",
                durationSec: (sourceBatch.input_data.durationSec as number) || 6,
            });
        }
    });

    // Safe fallback for render if accidentally opened with null
    if (!sourceBatch) return null;

    const update = (field: string, value: string | number) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setLoading(true);

        // Merge original inputs with the new modal overrides
        const inputData = {
            ...sourceBatch.input_data,
            theme: form.theme,
            accentColor: form.accentColor,
            format: form.format,
            durationSec: form.durationSec,
        };

        try {
            // Create the new Batch wrapper
            const resBatch = await fetch("/api/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_name: form.projectName,
                    input_data: inputData,
                })
            });

            const batchRecord = await resBatch.json();

            if (!resBatch.ok) {
                toast.error(batchRecord.error || tToasts("batchFailed"));
                setLoading(false);
                return;
            }

            // Launch render
            const resRender = await fetch("/api/render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batchId: batchRecord.id, inputData }),
            });

            const data = await resRender.json();

            if (!resRender.ok) {
                toast.error(data.error || tToasts("renderFailed"));
                setLoading(false);
                return;
            }

            toast.success(tToasts("renderSuccess", { count: data.jobCount }));
            onOpenChange(false);
            router.refresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to start render";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !loading && onOpenChange(val)}>
            <DialogContent className="max-w-2xl sm:max-w-2xl bg-zinc-950 border-zinc-800 p-0 overflow-hidden">
                <div className="p-6 pb-2 border-b border-zinc-800 flex flex-col gap-1">
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <Check className="h-5 w-5 text-brand" />
                        {t("title")}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground w-full break-words">
                        {t("subtitle")} <span className="text-zinc-300 font-semibold">{sourceBatch.project_name}</span>{t("subtitleSuffix")}
                    </p>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {/* Progress tracking */}
                    <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-4">
                        <button
                            onClick={() => setCurrentStep("style")}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                                currentStep === "style" ? "bg-brand/10 text-brand border border-brand/20" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                            )}>
                            <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", currentStep === "style" ? "bg-brand text-black" : "bg-zinc-800")}>1</span>
                            {t("stepStyle")}
                        </button>
                        <button
                            onClick={() => setCurrentStep("output")}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                                currentStep === "output" ? "bg-brand/10 text-brand border border-brand/20" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                            )}>
                            <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", currentStep === "output" ? "bg-brand text-black" : "bg-zinc-800")}>2</span>
                            {t("stepOutput")}
                        </button>
                    </div>

                    {currentStep === "style" && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label>{t("projectName")}</Label>
                                <Input
                                    value={form.projectName}
                                    onChange={(e) => update("projectName", e.target.value)}
                                    placeholder={t("projectNamePlaceholder")}
                                    className="bg-zinc-900 border-zinc-800"
                                />
                            </div>

                            <ThemeSelector
                                theme={form.theme}
                                accentColor={form.accentColor}
                                update={update}
                                THEMES={THEMES}
                                ThemePreviewSVG={ThemePreviewSVG}
                            />
                        </div>
                    )}

                    {currentStep === "output" && (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Label>{t("format")}</Label>
                                <div className="grid grid-cols-3 gap-3">
                                    {formatOptions.map((opt) => {
                                        const Icon = opt.icon;
                                        const isSelected = form.format === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                onClick={() => update("format", opt.value)}
                                                className={cn(
                                                    "border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-3 transition-all",
                                                    isSelected ? "border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                                                )}
                                            >
                                                <Icon className={cn("h-6 w-6", isSelected ? "text-amber-500" : "text-zinc-400")} />
                                                <span className={cn("font-medium text-sm", isSelected ? "text-amber-500" : "text-zinc-300")}>{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Label>{t("duration")}</Label>
                                <div className="flex items-center gap-2 p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl w-fit">
                                    {[6, 10, 15].map((val) => (
                                        <button
                                            key={val}
                                            onClick={() => update("durationSec", val)}
                                            className={cn(
                                                "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                                                form.durationSec === val
                                                    ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                            )}
                                        >
                                            {val}s
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-800 bg-black/50 flex justify-between items-center rounded-b-lg">
                    {currentStep === "output" ? (
                        <Button variant="ghost" onClick={() => setCurrentStep("style")} disabled={loading}>
                            {t("back")}
                        </Button>
                    ) : (
                        <div />
                    )}

                    {currentStep === "style" ? (
                        <Button onClick={() => setCurrentStep("output")} disabled={loading}>
                            {t("next")}
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    {t("generating")}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    {t("generate", { images: GENERATION_CONFIG.IMAGE_COUNT, videos: GENERATION_CONFIG.VIDEO_COUNT })}
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
