"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ChevronDown, ChevronUp, ExternalLink, Download, Check, Zap } from "lucide-react";
import { toast } from "sonner";
import { useSpySession, type CreativeBlueprint } from "@/hooks/useSpySession";
import { cn } from "@/lib/utils";

interface CreativeGalleryProps {
    onGenerate: (selectedBlueprints: CreativeBlueprint[], resolution: string) => void;
    isGenerating: boolean;
}

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

export function CreativeGallery({ onGenerate, isGenerating }: CreativeGalleryProps) {
    const t = useTranslations("SpyMode.step3");
    const {
        storeAnalysis,
        competitors,
        blueprints,
        setBlueprints,
        toggleBlueprint,
        updateBlueprintPrompt,
        updateBlueprintAspectRatio,
    } = useSpySession();

    const [isExtracting, setIsExtracting] = useState(false);
    const [globalResolution, setGlobalResolution] = useState<"1K" | "2K" | "4K">("1K");

    const selectedBlueprints = blueprints.filter((b) => b.isSelected && b.creativeType !== "ugc_video");
    const resolutionCostMap: Record<string, number> = { "1K": 1, "2K": 2, "4K": 3 };
    const totalCost = selectedBlueprints.length * resolutionCostMap[globalResolution];

    async function handleExtract() {
        if (!storeAnalysis?.id) return;
        const selectedCompetitorIds = competitors
            .filter((c) => c.isSelected)
            .map((c) => c.id)
            .filter((id) => !id.startsWith("manual_"));

        if (selectedCompetitorIds.length === 0) {
            toast.error("No valid competitors selected.");
            return;
        }

        setIsExtracting(true);
        try {
            const res = await fetch("/api/spy/extract-creatives", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    storeAnalysisId: storeAnalysis.id,
                    competitorIds: selectedCompetitorIds,
                }),
            });
            const data = await res.json();
            if (data.status === "done" && Array.isArray(data.blueprints)) {
                // Denormalize competitor name for display
                const competitorMap = Object.fromEntries(
                    competitors.map((c) => [c.id, c.competitorName]),
                );
                setBlueprints(
                    data.blueprints.map((b: CreativeBlueprint) => ({
                        ...b,
                        competitorName: b.competitorAnalysisId
                            ? competitorMap[b.competitorAnalysisId]
                            : undefined,
                    })),
                );
            } else {
                toast.error(t("extracting"));
            }
        } catch {
            toast.error("Extraction failed. Please try again.");
        } finally {
            setIsExtracting(false);
        }
    }

    if (blueprints.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 py-8">
                <p className="text-muted-foreground text-sm text-center">
                    Ready to extract creative blueprints from your selected competitors.
                </p>
                <Button
                    onClick={handleExtract}
                    disabled={isExtracting}
                    className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none gap-2"
                >
                    {isExtracting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Zap className="h-4 w-4" />
                    )}
                    {isExtracting ? t("extracting") : t("extractBtn")}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                        {selectedBlueprints.length} selected
                        {totalCost > 0 && (
                            <span className="ml-2 text-amber-400 font-medium">
                                — {totalCost} ⚡
                            </span>
                        )}
                    </p>
                    {/* Resolution selector */}
                    <div className="flex rounded-md border border-border overflow-hidden text-xs">
                        {(["1K", "2K", "4K"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setGlobalResolution(r)}
                                className={cn(
                                    "px-2.5 py-1.5 transition-colors",
                                    globalResolution === r
                                        ? "bg-amber-500 text-black font-medium"
                                        : "bg-transparent text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {r} ({resolutionCostMap[r]}⚡)
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExtract}
                        disabled={isExtracting}
                        className="gap-1.5"
                    >
                        {isExtracting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Zap className="h-3.5 w-3.5" />
                        )}
                        Re-extract
                    </Button>
                    <Button
                        onClick={() => onGenerate(selectedBlueprints, globalResolution)}
                        disabled={selectedBlueprints.length === 0 || isGenerating}
                        className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none gap-2"
                    >
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Zap className="h-4 w-4" />
                        )}
                        {t("generateSelected")} ({totalCost} ⚡)
                    </Button>
                </div>
            </div>

            {/* Blueprint grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blueprints.map((blueprint) => (
                    <BlueprintCard
                        key={blueprint.id}
                        blueprint={blueprint}
                        resolution={globalResolution}
                        onToggle={() => toggleBlueprint(blueprint.id)}
                        onPromptChange={(p) => updateBlueprintPrompt(blueprint.id, p)}
                        onAspectRatioChange={(ar) =>
                            updateBlueprintAspectRatio(blueprint.id, ar)
                        }
                        competitors={competitors}
                        t={t}
                    />
                ))}
            </div>
        </div>
    );
}

function BlueprintCard({
    blueprint,
    resolution,
    onToggle,
    onPromptChange,
    onAspectRatioChange,
    competitors,
    t,
}: {
    blueprint: CreativeBlueprint;
    resolution: string;
    onToggle: () => void;
    onPromptChange: (p: string) => void;
    onAspectRatioChange: (ar: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    competitors: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const [showPrompt, setShowPrompt] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const isUgc = blueprint.creativeType === "ugc_video";

    const competitorName =
        blueprint.competitorName ??
        competitors.find((c) => c.id === blueprint.competitorAnalysisId)?.competitorName;

    const sourceStyle =
        SOURCE_STYLES[blueprint.sourceLabel as keyof typeof SOURCE_STYLES] ??
        SOURCE_STYLES.market_trend;

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

    return (
        <Card
            className={cn(
                "border transition-colors",
                blueprint.isSelected && !isUgc
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border bg-card",
                isUgc && "opacity-80",
            )}
        >
            <CardContent className="pt-4 space-y-3">
                {/* Header */}
                <div className="flex items-start gap-2">
                    {!isUgc && (
                        <button
                            onClick={onToggle}
                            className={cn(
                                "mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                blueprint.isSelected
                                    ? "border-amber-500 bg-amber-500"
                                    : "border-border bg-transparent",
                            )}
                        >
                            {blueprint.isSelected && <Check className="h-2.5 w-2.5 text-black" />}
                        </button>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight">{blueprint.creativeName}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span
                                className={cn(
                                    "text-xs px-2 py-0.5 rounded-full border",
                                    TYPE_COLORS[blueprint.creativeType] ?? "bg-muted text-muted-foreground",
                                )}
                            >
                                {t(`types.${blueprint.creativeType}`) ?? blueprint.creativeType}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border", sourceStyle)}>
                                {blueprint.sourceLabel === "cloned_from_competitor" && competitorName
                                    ? t("clonedFrom", { name: competitorName })
                                    : t("marketTrend")}
                            </span>
                            {isUgc && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                    {t("comingSoon")}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Description (collapsible) */}
                <div>
                    <button
                        onClick={() => setShowDesc((v) => !v)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showDesc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Description
                    </button>
                    {showDesc && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                            {blueprint.description}
                        </p>
                    )}
                </div>

                {/* Prompt (collapsible, editable) */}
                {!isUgc && (
                    <div>
                        <button
                            onClick={() => setShowPrompt((v) => !v)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showPrompt ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {t("editPrompt")}
                        </button>
                        {showPrompt && (
                            <textarea
                                className="mt-1.5 w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs min-h-[80px] resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={blueprint.reproductionPrompt}
                                onChange={(e) => onPromptChange(e.target.value)}
                            />
                        )}
                    </div>
                )}

                {/* Footer controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Aspect ratio */}
                    {!isUgc && (
                        <select
                            value={blueprint.aspectRatio}
                            onChange={(e) => onAspectRatioChange(e.target.value)}
                            className="text-xs rounded border border-border bg-background px-2 py-1 text-muted-foreground focus:outline-none"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {["9:16", "1:1", "16:9", "4:5"].map((ar) => (
                                <option key={ar} value={ar}>
                                    {ar}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* UGC script download */}
                    {isUgc && blueprint.ugcScript && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadScript}
                            className="gap-1.5 text-xs h-7"
                        >
                            <Download className="h-3 w-3" />
                            {t("downloadScript")}
                        </Button>
                    )}

                    {/* Ad Library link */}
                    {competitorName && (
                        <a
                            href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(competitorName)}&search_type=keyword_unordered`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {t("viewAds")}
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
