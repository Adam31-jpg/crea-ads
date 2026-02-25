"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Play, AlertTriangle, Loader2, MoreVertical, RotateCcw, Archive, ArchiveRestore, Trash2, Image, Video, Check, X, RefreshCw, Clock, Film, CheckCircle2, HeartPulse, Palette, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { DuplicateBatchModal } from "@/components/modals/DuplicateBatchModal";

// --- Types ---

export interface Job {
    id: string;
    status: string;
    type: string;
    result_url: string | null;
    error_message: string | null;
    template_id: string;
    created_at?: string;
}

export interface Batch {
    id: string;
    project_name: string;
    status: string;
    created_at: string;
    is_archived?: boolean;
    input_data: Record<string, unknown>;
    jobs: Job[];
}

// --- Smart Status Labels ---

const STUCK_THRESHOLD_MS = 150_000;

function getSmartLabel(elapsedMs: number, t: any): string {
    if (elapsedMs < 30_000) return t("smartLabels.launching");
    if (elapsedMs < 100_000) return t("smartLabels.frames");
    return t("smartLabels.uploading");
}

function getSmartLabelShort(elapsedMs: number, t: any): string {
    if (elapsedMs < 30_000) return t("smartLabels.short.launching");
    if (elapsedMs < 100_000) return t("smartLabels.short.frames");
    return t("smartLabels.short.uploading");
}

function getBatchSmartLabel(jobs: Job[], t: any): string {
    const renderingJobs = jobs.filter(
        (j) =>
            j.status === "rendering" ||
            j.status === "processing" ||
            j.status === "generating_assets"
    );
    if (renderingJobs.length === 0) return "Rendering";

    const oldest = renderingJobs.reduce((acc, j) => {
        const t = j.created_at ? new Date(j.created_at).getTime() : Date.now();
        const accT = acc.created_at
            ? new Date(acc.created_at).getTime()
            : Date.now();
        return t < accT ? j : acc;
    });

    const elapsed =
        Date.now() -
        (oldest.created_at ? new Date(oldest.created_at).getTime() : Date.now());
    return getSmartLabel(elapsed, t);
}

// --- Helpers ---

const statusVariant = (status: string) => {
    switch (status) {
        case "done":
            return "success" as const;
        case "failed":
            return "destructive" as const;
        case "rendering":
        case "processing":
        case "generating_assets":
            return "warning" as const;
        default:
            return "secondary" as const;
    }
};

// --- Component ---

interface BatchCardProps {
    batch: Batch;
    showUnarchive?: boolean;
}

export function BatchCard({ batch, showUnarchive }: BatchCardProps) {
    const t = useTranslations("Dashboard.batch");
    const [previewAsset, setPreviewAsset] = useState<Job | null>(null);
    const [errorDetail, setErrorDetail] = useState<string | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [duplicateOpen, setDuplicateOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [retryingJobs, setRetryingJobs] = useState<Set<string>>(new Set());
    const [resyncing, setResyncing] = useState(false);
    const [autoResynced, setAutoResynced] = useState(false);
    const [, setTick] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const router = useRouter();

    const jobs = batch.jobs || [];
    const hasMultipleJobs = jobs.length > 1;
    const primaryJob = jobs[0];

    // Computed batch status from jobs
    const isRendering =
        jobs.length > 0
            ? jobs.some(
                (j) =>
                    j.status === "rendering" ||
                    j.status === "processing" ||
                    j.status === "generating_assets" ||
                    j.status === "pending"
            )
            : batch.status === "rendering" || batch.status === "processing" || batch.status === "generating_assets" || batch.status === "pending";

    const isFailed = !isRendering && jobs.some((j) => j.status === "failed");
    const isDone = !isRendering && !isFailed && jobs.every((j) => j.status === "done");

    const batchStatus = isRendering ? "rendering" : isFailed ? "failed" : isDone ? "done" : "pending";

    // Expiration calculation (15 days)
    const MAX_RETENTION_MS = 15 * 24 * 60 * 60 * 1000;
    const batchAgeMs = Date.now() - new Date(batch.created_at).getTime();
    const remainingMs = MAX_RETENTION_MS - batchAgeMs;
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    const isExpiringSoon = remainingDays <= 3;
    const isExpired = remainingDays === 0;

    const doneCount = jobs.filter((j) => j.status === "done").length;
    const failedCount = jobs.filter((j) => j.status === "failed").length;
    const stuckCount = jobs.filter((j) => {
        if (
            j.status !== "rendering" &&
            j.status !== "processing" &&
            j.status !== "generating_assets"
        )
            return false;
        const elapsed = j.created_at
            ? Date.now() - new Date(j.created_at).getTime()
            : 0;
        return elapsed > STUCK_THRESHOLD_MS;
    }).length;
    const totalCount = jobs.length;

    // Show global "Retry All" / "Re-sync"
    const showSyncRetryBtn = failedCount > 0 || (isRendering && stuckCount > 0);

    // Timer: tick every second while rendering
    const startTimer = useCallback(() => {
        if (timerRef.current) return;
        timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (isRendering) startTimer();
        else stopTimer();
        return stopTimer;
    }, [isRendering, startTimer, stopTimer]);

    // --- Auto-Resync Stuck Jobs ---
    useEffect(() => {
        if (!isRendering) return;

        // Check if any job is stuck
        const hasStuckJob = jobs.some(j => {
            if (j.status !== "rendering" && j.status !== "processing" && j.status !== "generating_assets") return false;
            const elapsed = j.created_at ? Date.now() - new Date(j.created_at).getTime() : 0;
            return elapsed > 120_000;
        });

        if (hasStuckJob && !autoResynced) {
            console.log(`[BatchCard] Detected stuck jobs. Auto-resyncing batch ${batch.id}...`);
            setAutoResynced(true); // Ensure it only fires once automatically
            // Need to wrap in an async IIFE to call handleResync internally without dependency cycles
            // but handleResync is defined below. Let's define the resync loop directly here to avoid dependency issues.
            const autoTriggerResync = async () => {
                const stuckJobs = jobs.filter(j =>
                    (j.status === "rendering" || j.status === "processing" || j.status === "generating_assets") &&
                    (j.created_at ? Date.now() - new Date(j.created_at).getTime() > 120_000 : false)
                );

                // Stagger status checks by 600 ms each to avoid hitting the
                // AWS Lambda GetFunction API rate limit simultaneously.
                for (let i = 0; i < stuckJobs.length; i++) {
                    if (i > 0) await new Promise((r) => setTimeout(r, 600));
                    await fetch(`/api/render/status?jobId=${stuckJobs[i].id}`).catch(() => { });
                }
                router.refresh();
            };
            autoTriggerResync();
        }
    }, [isRendering, jobs, autoResynced, batch.id, router]);

    // --- Actions ---

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/batch/${batch.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || t("toasts.delFailed"));
            else {
                toast.success(t("toasts.delSuccess"));
                router.refresh();
            }
        } catch {
            toast.error(t("toasts.delFailed"));
        } finally {
            setDeleting(false);
            setDeleteOpen(false);
        }
    };

    const handleDuplicate = () => {
        setDuplicateOpen(true);
    };

    const handleSyncAndRetry = async () => {
        setResyncing(true);
        try {
            const stuckJobs = jobs.filter(j => j.status === "rendering" || j.status === "processing" || j.status === "generating_assets");

            // Re-sync stuck jobs — staggered to avoid AWS throttling
            for (let i = 0; i < stuckJobs.length; i++) {
                if (i > 0) await new Promise((r) => setTimeout(r, 600));
                await fetch(`/api/render/status?jobId=${stuckJobs[i].id}`).catch(() => { });
            }

            // Retry failed jobs at the batch level
            if (failedCount > 0) {
                const res = await fetch(`/api/batch/${batch.id}/retry`, { method: "POST" });
                if (!res.ok) {
                    const data = await res.json();
                    toast.error(data.error || t("toasts.retryFailed"));
                }
            }

            toast.success("Synchronisation et relance complètes");
            router.refresh();
        } catch {
            toast.error("Erreur lors de la synchronisation");
        }
        setResyncing(false);
    };

    const handleRetryJob = async (jobId: string) => {
        setRetryingJobs((prev) => new Set(prev).add(jobId));
        try {
            const res = await fetch(`/api/job/${jobId}/retry`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || t("toasts.jobRetryFailed"));
            else {
                toast.success(t("toasts.jobRetrySuccess"));
                router.refresh();
            }
        } catch {
            toast.error(t("toasts.jobRetryFailed"));
        }
        setRetryingJobs((prev) => {
            const next = new Set(prev);
            next.delete(jobId);
            return next;
        });
    };

    const handleArchiveToggle = async () => {
        const newArchived = !batch.is_archived;
        try {
            const res = await fetch(`/api/batch/${batch.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_archived: newArchived }),
            });
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || t("toasts.actionFailed"));
            } else {
                toast.success(newArchived ? t("toasts.archived") : t("toasts.restored"));
                router.refresh();
            }
        } catch {
            toast.error(t("toasts.actionFailed"));
        }
    };

    // --- Cell Component ---

    const JobCell = ({ job }: { job: Job }) => {
        const hasResult = !!job.result_url;
        const jobDone = job.status === "done" || hasResult; // Overrule state if result exists
        const jobFailed = job.status === "failed" && !hasResult;
        const jobRendering =
            (job.status === "rendering" ||
                job.status === "processing" ||
                job.status === "generating_assets") && !hasResult;
        const isVideo = job.type === "video";
        const isRetryingThis = retryingJobs.has(job.id);

        const elapsedMs = job.created_at
            ? Date.now() - new Date(job.created_at).getTime()
            : 0;
        const isStuck = jobRendering && elapsedMs > 120_000;

        // If it was already auto-resynced but still stuck after, consider it failed UX-wise
        const isVisualFailure = jobFailed || (isStuck && autoResynced);

        return (
            <button
                key={job.id}
                onClick={() => {
                    if (jobDone) setPreviewAsset(job);
                    else if (jobFailed)
                        setErrorDetail(job.error_message || "An unknown error occurred.");
                    else if (isStuck) handleRetryJob(job.id);
                }}
                title={
                    isStuck
                        ? t("cell.stuck")
                        : jobRendering
                            ? getSmartLabel(elapsedMs, t)
                            : jobFailed
                                ? t("cell.error")
                                : jobDone
                                    ? t("cell.preview")
                                    : ""
                }
                className={`relative aspect-square rounded-lg border-2 transition-all overflow-hidden ${jobDone
                    ? "border-success/30 bg-success/5 hover:border-success cursor-pointer"
                    : isVisualFailure
                        ? "border-destructive/30 bg-destructive/5 hover:border-destructive cursor-pointer"
                        : isStuck
                            ? "border-amber-500/40 bg-amber-500/10 hover:border-amber-500 cursor-pointer"
                            : jobRendering
                                ? "border-brand/20 bg-brand/5"
                                : "border-border bg-muted/30"
                    }`}
            >
                {/* Video badge — always visible */}
                {isVideo && (
                    <div className="absolute top-1 right-1 z-20 rounded bg-black/40 px-1">
                        <Video className="h-3 w-3 text-brand" />
                    </div>
                )}

                {/* States */}
                {isRetryingThis && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-brand" />
                    </div>
                )}

                {!isRetryingThis && isStuck && !isVisualFailure && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                        <RefreshCw className="h-4 w-4 text-amber-500" />
                        <span className="text-[9px] text-amber-500 font-semibold">
                            {t("cell.retry")}
                        </span>
                    </div>
                )}

                {!isRetryingThis && jobRendering && !isStuck && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                        <Loader2 className="h-4 w-4 animate-spin text-brand" />
                        <span className="text-[8px] text-muted-foreground font-medium leading-none text-center">
                            {isVideo ? 'Vidéo' : 'Image'}
                        </span>
                    </div>
                )}

                {jobDone && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {job.result_url && isVideo ? (
                            <Play className="h-5 w-5 text-success" />
                        ) : job.result_url && !isVideo ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={job.result_url}
                                alt={`Asset ${job.id}`}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <Check className="h-5 w-5 text-success" />
                        )}
                    </div>
                )}

                {isVisualFailure && !isRetryingThis && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="absolute inset-0 flex items-center justify-center cursor-help">
                                    <X className="h-5 w-5 text-destructive" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[280px] text-xs leading-relaxed z-50 p-3">
                                Échec du rendu. Pas d'inquiétude : vos Sparks ne sont débités que pour les créatives réussies. Essayez de relancer via le bouton de synchronisation. Si le problème persiste,{' '}
                                <a href="/bug" target="_blank" rel="noopener noreferrer" className="underline font-medium text-brand">
                                    signalez-le ici
                                </a>.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {!jobRendering && !jobDone && !isVisualFailure && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {isVideo ? (
                            <Video className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <Image className="h-4 w-4 text-muted-foreground" />
                        )}
                    </div>
                )}
            </button>
        );
    };

    // Preview aspect ratio
    // input_data stores the raw format string (e.g. "1080x1920"), not an "aspectRatio" key.
    // Reading the wrong field made ratioValue always fall back to "9/16" regardless of format.
    const FORMAT_TO_CSS_RATIO: Record<string, string> = {
        "1080x1920": "9/16",
        "1920x1080": "16/9",
        "1080x1080": "1/1",
        "1080x1350": "4/5",
    };
    const format = (batch.input_data?.format as string) || "1080x1920";
    const ratioValue = FORMAT_TO_CSS_RATIO[format] ?? "9/16";
    // Used to narrow the preview dialog for portrait orientations so the modal
    // doesn't become taller than the viewport.
    const isPortrait = ratioValue === "9/16" || ratioValue === "4/5";

    return (
        <>
            <Card
                className={`group relative overflow-hidden transition-all min-h-[220px] ${isRendering
                    ? "border-brand/40 shadow-[0_0_20px_-4px_hsl(var(--brand)/0.3)] animate-[glow-pulse_3s_ease-in-out_infinite]"
                    : isDone
                        ? "border-success/20 hover:border-success/40"
                        : isFailed
                            ? "border-destructive/20 hover:border-destructive/40"
                            : "hover:border-brand/30"
                    }`}
            >
                <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-xl font-bold truncate flex items-center gap-2">
                                {batch.project_name}
                                {isDone && !isExpired && (
                                    <Badge
                                        variant={isExpiringSoon ? "destructive" : "outline"}
                                        className={`font-normal text-[10px] h-5 transition-all ${isExpiringSoon ? "animate-pulse" : "border-purple-500/40 bg-purple-500/10 text-purple-300 shadow-[0_0_15px_rgba(138,43,226,0.3)] hover:shadow-[0_0_20px_rgba(138,43,226,0.5)]"}`}
                                        title="To maintain optimal system performance, your generated media is kept for 15 days. Please download your assets before this batch is permanently deleted from our servers."
                                    >
                                        <Clock className="h-3 w-3 mr-1" />
                                        {t("card.expiresIn", { days: remainingDays })}
                                    </Badge>
                                )}
                                {isDone && isExpired && (
                                    <Badge variant="destructive" className="font-normal text-[10px] h-5">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {t("card.expired")}
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription className="mt-1.5">
                                {new Date(batch.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                                {totalCount > 1 && (
                                    <span className="ml-2 text-muted-foreground">
                                        · {t("card.assetsCount", { count: totalCount })}
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={isFailed ? "outline" : statusVariant(batchStatus)} className={isFailed ? "border-destructive/30 text-destructive bg-destructive/5" : ""}>
                                {isRendering ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        Génération en cours... {doneCount}/{totalCount}
                                    </>
                                ) : isFailed ? (
                                    `Terminé : ${doneCount} Succès, ${failedCount} Échec(s)`
                                ) : (
                                    t(`status.${batchStatus}`)
                                )}
                            </Badge>

                            {showSyncRetryBtn && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 h-7 text-xs border-brand/30 hover:bg-brand/10 select-none"
                                                onClick={handleSyncAndRetry}
                                                disabled={resyncing}
                                            >
                                                {resyncing ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="h-3 w-3" />
                                                )}
                                                Synchroniser & Relancer
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[280px] text-xs leading-relaxed z-50 p-3">
                                            Si un rendu échoue, vous pouvez tenter de le relancer ici. Si l'échec persiste, aucun Spark ne sera débité. En cas de problème technique récurrent, veuillez{' '}
                                            <a href="/bug" target="_blank" rel="noopener noreferrer" className="underline font-medium text-brand">
                                                signaler un bug
                                            </a>.
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                        <span className="sr-only">Actions</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={handleArchiveToggle}>
                                        {showUnarchive ? (
                                            <>
                                                <ArchiveRestore className="h-4 w-4" />
                                                {t("card.unarchive")}
                                            </>
                                        ) : (
                                            <>
                                                <Archive className="h-4 w-4" />
                                                {t("card.archive")}
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => setDeleteOpen(true)}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        {t("card.delete")}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {hasMultipleJobs ? (
                        <>
                            {/* 2×5 Grid */}
                            <div className="grid grid-cols-5 grid-rows-2 gap-2">
                                {jobs.map((job) => (
                                    <JobCell key={job.id} job={job} />
                                ))}
                            </div>

                            {/* Download/Preview — only when batch is fully done */}
                            {isDone && (
                                <div className="flex items-center gap-2 pt-1">
                                    <Button size="sm" variant="outline" className="gap-1.5">
                                        <Download className="h-3.5 w-3.5" />
                                        {t("card.downloadAll")}
                                    </Button>
                                    <span className="text-xs text-muted-foreground">
                                        {t("card.previewHint")}
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            {isRendering && (
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                                    {t("card.renderingProgress")}
                                </p>
                            )}
                            {/* Download/Preview — only when done */}
                            {isDone && primaryJob?.result_url && (
                                <div 
                                    onClick={() => setPreviewAsset(primaryJob)} 
                                    style={{ 
                                        cursor: 'pointer',
                                        width: '100%',
                                        aspectRatio: ratioValue,
                                        overflow: 'hidden',
                                        borderRadius: 'var(--radius)',
                                        backgroundColor: '#f4f4f5'
                                    }}
                                >
                                    <img 
                                        src={primaryJob.result_url} 
                                        alt="Batch preview" 
                                        style={{ 
                                            width: '100%', 
                                            height: '100%', 
                                            objectFit: 'cover' 
                                        }} 
                                    />
                                </div>
                            )}
                            {isFailed && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="gap-1.5"
                                    onClick={() =>
                                        setErrorDetail(
                                            primaryJob?.error_message || "An unknown error occurred."
                                        )
                                    }
                                >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    {t("card.errorLog")}
                                </Button>
                            )}
                            {batchStatus === "pending" && (
                                <p className="text-sm text-muted-foreground truncate">
                                    {t("card.waiting")}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Progress bar — visible during rendering */}
                    {isRendering && totalCount > 1 && (
                        <Progress value={doneCount} max={totalCount} />
                    )}
                </CardContent>
            </Card>

            {/* Asset Preview Dialog */}
            <Dialog
                open={!!previewAsset}
                onOpenChange={() => setPreviewAsset(null)}
            >
                <DialogContent className={isPortrait ? "sm:max-w-sm" : "sm:max-w-2xl"}>
                    <DialogHeader>
                        <DialogTitle>{batch.project_name}</DialogTitle>
                        <DialogDescription>
                            {previewAsset?.type === "video"
                                ? t("dialogs.previewVideo")
                                : t("dialogs.previewImage")}
                        </DialogDescription>
                    </DialogHeader>
                    {previewAsset?.result_url && previewAsset.type === "video" && (
                        <div 
                            className="rounded-lg overflow-hidden bg-black w-full"
                            style={{ aspectRatio: ratioValue }}
                        >
                            <video
                                src={previewAsset.result_url}
                                controls
                                muted
                                autoPlay
                                className="h-full w-full object-cover"
                            />
                        </div>
                    )}
                    {previewAsset?.result_url && previewAsset.type === "image" && (
                        <div 
                            className="rounded-lg overflow-hidden bg-black flex items-center justify-center w-full"
                            style={{ aspectRatio: ratioValue }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={previewAsset.result_url}
                                alt="Full size preview"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    {previewAsset?.result_url && (
                        <div className="flex justify-end">
                            <Button size="sm" variant="outline" className="gap-1.5" asChild>
                                <a
                                    href={previewAsset.result_url}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    {t("card.download")}
                                </a>
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Error Detail Dialog */}
            <Dialog open={!!errorDetail} onOpenChange={() => setErrorDetail(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            {t("dialogs.errorTitle")}
                        </DialogTitle>
                        <DialogDescription>
                            {t("dialogs.errorDesc")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3">
                        <p className="text-sm text-foreground">{errorDetail}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t("dialogs.errorHint")}
                    </p>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("dialogs.deleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t.rich("dialogs.deleteDesc", {
                                name: batch.project_name,
                                count: totalCount,
                                strong: (chunks) => <strong>{chunks}</strong>
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>{t("dialogs.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    {t("dialogs.deleting")}
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    {t("dialogs.deleteConfirm")}
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <DuplicateBatchModal
                open={duplicateOpen}
                onOpenChange={setDuplicateOpen}
                sourceBatch={batch}
            />
        </>
    );
}
