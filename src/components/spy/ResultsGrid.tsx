"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Loader2, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useSpySession, type GeneratedJob, type CreativeBlueprint } from "@/hooks/useSpySession";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ResultsGridProps {
    onRegenerate: (blueprintId: string, productImageUrl: string, resolution: string) => Promise<void>;
    onNewSpy: () => void;
}

export function ResultsGrid({ onRegenerate, onNewSpy }: ResultsGridProps) {
    const t = useTranslations("SpyMode.step5");
    const { generatedJobs, blueprints, productImageUrl } = useSpySession();

    const doneJobs = generatedJobs.filter((j) => j.status === "done");
    const failedJobs = generatedJobs.filter((j) => j.status === "failed");
    const renderingJobs = generatedJobs.filter((j) => j.status === "rendering");

    const blueprintMap = Object.fromEntries(blueprints.map((b) => [b.id, b]));

    return (
        <div className="space-y-6">
            {/* Status bar */}
            {renderingJobs.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
                    Generating {renderingJobs.length} image{renderingJobs.length > 1 ? "s" : ""}…
                </div>
            )}

            {/* Failed notice */}
            {failedJobs.length > 0 && (
                <p className="text-sm text-destructive">
                    {failedJobs.length} generation{failedJobs.length > 1 ? "s" : ""} failed — Sparks refunded.
                </p>
            )}

            {/* Results grid */}
            {doneJobs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {doneJobs.map((job) => {
                        const bp = blueprintMap[job.blueprintId];
                        return (
                            <ResultCard
                                key={job.jobId}
                                job={job}
                                blueprint={bp}
                                productImageUrl={productImageUrl}
                                onRegenerate={onRegenerate}
                                t={t}
                            />
                        );
                    })}
                </div>
            )}

            {/* Empty state */}
            {doneJobs.length === 0 && renderingJobs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                    No results yet. Generate some creatives first.
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-border">
                <Button variant="outline" onClick={onNewSpy} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    {t("newSpy")}
                </Button>
                {doneJobs.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                        {doneJobs.length} creative{doneJobs.length > 1 ? "s" : ""} generated
                    </p>
                )}
            </div>
        </div>
    );
}

function ResultCard({
    job,
    blueprint,
    productImageUrl,
    onRegenerate,
    t,
}: {
    job: GeneratedJob;
    blueprint: CreativeBlueprint | undefined;
    productImageUrl: string | null;
    onRegenerate: (blueprintId: string, productImageUrl: string, resolution: string) => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}) {
    const [showEditPrompt, setShowEditPrompt] = useState(false);
    const [editedPrompt, setEditedPrompt] = useState(blueprint?.reproductionPrompt ?? "");
    const [isRegenerating, setIsRegenerating] = useState(false);
    const { updateBlueprintPrompt } = useSpySession();

    const canvaUrl = `https://www.canva.com/design/create?imageUrl=${encodeURIComponent(job.result_url)}`;

    function handleDownload() {
        const a = document.createElement("a");
        a.href = job.result_url;
        a.download = `lumina_spy_${job.jobId}.png`;
        a.target = "_blank";
        a.click();
    }

    async function handleRegenerate(useEditedPrompt = false) {
        if (!productImageUrl || !blueprint) {
            toast.error("Product image required.");
            return;
        }
        setIsRegenerating(true);
        try {
            if (useEditedPrompt && editedPrompt !== blueprint.reproductionPrompt) {
                updateBlueprintPrompt(blueprint.id, editedPrompt);
            }
            await onRegenerate(blueprint.id, productImageUrl, "1K");
        } finally {
            setIsRegenerating(false);
        }
    }

    return (
        <Card className="border-border bg-card overflow-hidden">
            {/* Image */}
            <div className="relative aspect-[9/16] bg-muted overflow-hidden">
                <Image
                    src={job.result_url}
                    alt={blueprint?.creativeName ?? "Generated creative"}
                    fill
                    className="object-cover"
                    unoptimized
                />
                {job.warning === "upload_failed" && (
                    <div className="absolute top-2 left-2 right-2 bg-amber-500/90 text-black text-xs px-2 py-1 rounded text-center">
                        Image may expire in 24h
                    </div>
                )}
            </div>

            <CardContent className="pt-3 space-y-3">
                {/* Source info */}
                {blueprint && (
                    <p className="text-xs text-muted-foreground truncate">
                        {blueprint.competitorName
                            ? t("basedOn", {
                                  competitor: blueprint.competitorName,
                                  type: blueprint.creativeType,
                              })
                            : blueprint.creativeName}
                    </p>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        className="gap-1.5 text-xs"
                    >
                        <Download className="h-3.5 w-3.5" />
                        {t("download")}
                    </Button>
                    <a href={canvaUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("editInCanva")}
                        </Button>
                    </a>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerate(false)}
                    disabled={isRegenerating}
                    className="w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                    {isRegenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {t("regenerate")} (1 ⚡)
                </Button>

                {/* Edit prompt */}
                <div>
                    <button
                        onClick={() => setShowEditPrompt((v) => !v)}
                        className={cn(
                            "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full",
                        )}
                    >
                        {showEditPrompt ? (
                            <ChevronUp className="h-3 w-3" />
                        ) : (
                            <ChevronDown className="h-3 w-3" />
                        )}
                        {t("editPrompt")}
                    </button>
                    {showEditPrompt && (
                        <div className="mt-1.5 space-y-2">
                            <textarea
                                className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs min-h-[72px] resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                            />
                            <Button
                                size="sm"
                                onClick={() => handleRegenerate(true)}
                                disabled={isRegenerating || !editedPrompt.trim()}
                                className="w-full text-xs bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none"
                            >
                                {isRegenerating ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                )}
                                Regenerate with new prompt (1 ⚡)
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
