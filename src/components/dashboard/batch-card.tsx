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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Play, AlertTriangle, Loader2, MoreVertical, RotateCcw, Archive, ArchiveRestore, Trash2, Image, Video, Check, X, RefreshCw, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

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
    const [deleting, setDeleting] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [retryingJobs, setRetryingJobs] = useState<Set<string>>(new Set());
    const [resyncing, setResyncing] = useState(false);
    const [, setTick] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const router = useRouter();

    const jobs = batch.jobs || [];
    const hasMultipleJobs = jobs.length > 1;
    const primaryJob = jobs[0];

    // Computed batch status from jobs
    const batchStatus =
        jobs.length > 0
            ? jobs.every((j) => j.status === "done")
                ? "done"
                : jobs.every((j) => j.status === "failed")
                    ? "failed"
                    : jobs.some(
                        (j) =>
                            j.status === "rendering" ||
                            j.status === "processing" ||
                            j.status === "generating_assets"
                    )
                        ? "rendering"
                        : batch.status
            : batch.status || "pending";

    const isRendering =
        batchStatus === "rendering" ||
        batchStatus === "processing" ||
        batchStatus === "generating_assets";
    const isDone = batchStatus === "done";
    const isFailed = batchStatus === "failed";

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

    // Show global "Retry All" only when >50% failed or stuck
    const problemCount = failedCount + stuckCount;
    const showGlobalRetry =
        totalCount > 0 && problemCount > 0 && problemCount / totalCount > 0.5;

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
        }
        setDeleting(false);
        setDeleteOpen(false);
    };

    const handleRetryAll = async () => {
        setRetrying(true);
        try {
            const res = await fetch(`/api/batch/${batch.id}/retry`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || t("toasts.retryFailed"));
            else {
                toast.success(t("toasts.retrySuccess"));
                router.refresh();
            }
        } catch {
            toast.error(t("toasts.retryFailed"));
        }
        setRetrying(false);
    };

    const handleResync = async () => {
        setResyncing(true);
        try {
            const stuckJobs = jobs.filter(j => j.status === "rendering" || j.status === "processing" || j.status === "generating_assets");
            if (stuckJobs.length === 0) {
                toast(t("toasts.noResync"));
                setResyncing(false);
                return;
            }

            // Re-sync by triggering the fallback active polling route
            for (const job of stuckJobs) {
                await fetch(`/api/render/status?jobId=${job.id}`);
            }
            toast.success(t("toasts.resyncSuccess"));
            router.refresh();
        } catch {
            toast.error(t("toasts.resyncFailed"));
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
        const jobDone = job.status === "done";
        const jobFailed = job.status === "failed";
        const jobRendering =
            job.status === "rendering" ||
            job.status === "processing" ||
            job.status === "generating_assets";
        const isVideo = job.type === "video";
        const isRetryingThis = retryingJobs.has(job.id);

        const elapsedMs = job.created_at
            ? Date.now() - new Date(job.created_at).getTime()
            : 0;
        const isStuck = jobRendering && elapsedMs > STUCK_THRESHOLD_MS;

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
                    : jobFailed
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

                {!isRetryingThis && isStuck && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                        <RefreshCw className="h-4 w-4 text-amber-500" />
                        <span className="text-[9px] text-amber-500 font-semibold">
                            {t("cell.retry")}
                        </span>
                    </div>
                )}

                {!isRetryingThis && jobRendering && !isStuck && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                        <Loader2 className="h-4 w-4 animate-[spin_3s_linear_infinite] text-brand" />
                        <span className="text-[8px] text-muted-foreground font-medium leading-none text-center">
                            {getSmartLabelShort(elapsedMs, t)}
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

                {jobFailed && !isRetryingThis && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <X className="h-5 w-5 text-destructive" />
                    </div>
                )}

                {!jobRendering && !jobDone && !jobFailed && (
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
                            <Badge variant={statusVariant(batchStatus)}>
                                {isRendering && (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                )}
                                {isRendering && hasMultipleJobs
                                    ? getBatchSmartLabel(jobs, t)
                                    : t(`status.${batchStatus}`)}
                                {isRendering && totalCount > 1 && (
                                    <span className="ml-1 tabular-nums">
                                        {doneCount}/{totalCount}
                                    </span>
                                )}
                            </Badge>

                            {showGlobalRetry && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 h-7 text-xs border-brand/30 hover:bg-brand/10"
                                    onClick={handleRetryAll}
                                    disabled={retrying}
                                >
                                    {retrying ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <RotateCcw className="h-3 w-3" />
                                    )}
                                    {retrying ? t("card.retrying") : t("card.retryAll")}
                                </Button>
                            )}

                            {isRendering && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 h-7 text-xs border-brand/30 hover:bg-brand/10 select-none"
                                    onClick={handleResync}
                                    disabled={resyncing}
                                >
                                    {resyncing ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-3 w-3" />
                                    )}
                                    {t("card.resync")}
                                </Button>
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
                                    <Loader2 className="h-4 w-4 animate-[spin_3s_linear_infinite] text-brand" />
                                    {t("card.renderingProgress")}
                                </p>
                            )}
                            {/* Download/Preview — only when done */}
                            {isDone && primaryJob?.result_url && (
                                <>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5"
                                        asChild
                                    >
                                        <a
                                            href={primaryJob.result_url}
                                            download
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                            {t("card.download")}
                                        </a>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="gap-1.5"
                                        onClick={() => setPreviewAsset(primaryJob)}
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                        {t("card.preview")}
                                    </Button>
                                </>
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
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{batch.project_name}</DialogTitle>
                        <DialogDescription>
                            {previewAsset?.type === "video"
                                ? t("dialogs.previewVideo")
                                : t("dialogs.previewImage")}
                        </DialogDescription>
                    </DialogHeader>
                    {previewAsset?.result_url && previewAsset.type === "video" && (
                        <div className="aspect-video rounded-lg overflow-hidden bg-black">
                            <video
                                src={previewAsset.result_url}
                                controls
                                muted
                                autoPlay
                                className="h-full w-full object-contain"
                            />
                        </div>
                    )}
                    {previewAsset?.result_url && previewAsset.type === "image" && (
                        <div className="rounded-lg overflow-hidden bg-black flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={previewAsset.result_url}
                                alt="Full size preview"
                                className="max-h-[70vh] object-contain"
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
        </>
    );
}
