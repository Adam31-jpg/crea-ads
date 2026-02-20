"use client";

import { useState } from "react";
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
import {
    Download,
    Play,
    AlertTriangle,
    Loader2,
    MoreVertical,
    RotateCcw,
    Archive,
    ArchiveRestore,
    Trash2,
    Image,
    Video,
    Check,
    X,
} from "lucide-react";

export interface Job {
    id: string;
    status: string;
    type: string;
    result_url: string | null;
    error_message: string | null;
    template_id: string;
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

const statusLabel = (status: string) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface BatchCardProps {
    batch: Batch;
    showUnarchive?: boolean;
}

export function BatchCard({ batch, showUnarchive }: BatchCardProps) {
    const [previewAsset, setPreviewAsset] = useState<Job | null>(null);
    const [errorDetail, setErrorDetail] = useState<string | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const router = useRouter();

    const jobs = batch.jobs || [];
    const hasMultipleJobs = jobs.length > 1;
    const primaryJob = jobs[0];
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
    const hasFailed = jobs.some((j) => j.status === "failed");

    const doneCount = jobs.filter((j) => j.status === "done").length;
    const totalCount = jobs.length;

    // --- Actions ---

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/batch/${batch.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Delete failed");
            } else {
                toast.success("Batch and associated assets permanently deleted.");
                router.refresh();
            }
        } catch {
            toast.error("Failed to delete batch");
        }
        setDeleting(false);
        setDeleteOpen(false);
    };

    const handleRetry = async () => {
        setRetrying(true);
        try {
            const res = await fetch(`/api/batch/${batch.id}/retry`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Retry failed");
            } else {
                toast.success("Render re-submitted! Check back shortly.");
                router.refresh();
            }
        } catch {
            toast.error("Failed to retry batch");
        }
        setRetrying(false);
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
                toast.error(data.error || "Action failed");
            } else {
                toast.success(newArchived ? "Batch archived." : "Batch restored.");
                router.refresh();
            }
        } catch {
            toast.error("Failed to update batch");
        }
    };

    return (
        <>
            <Card className="group relative overflow-hidden hover:border-brand/30 transition-colors">
                {/* Shimmer overlay for rendering state */}
                {isRendering && (
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand/5 to-transparent animate-shimmer" />
                    </div>
                )}

                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base truncate pr-2">
                            {batch.project_name}
                        </CardTitle>
                        <div className="flex items-center gap-1.5">
                            <Badge variant={statusVariant(batchStatus)}>
                                {isRendering && (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                )}
                                {statusLabel(batchStatus)}
                                {isRendering && totalCount > 1 && (
                                    <span className="ml-1 tabular-nums">
                                        {doneCount}/{totalCount}
                                    </span>
                                )}
                            </Badge>

                            {/* Visible Retry button for failed batches */}
                            {hasFailed && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 h-7 text-xs border-brand/30 hover:bg-brand/10"
                                    onClick={handleRetry}
                                    disabled={retrying}
                                >
                                    {retrying ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <RotateCcw className="h-3 w-3" />
                                    )}
                                    {retrying ? "Retrying…" : "Retry"}
                                </Button>
                            )}

                            {/* Ellipsis menu — Archive & Delete */}
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
                                                Unarchive
                                            </>
                                        ) : (
                                            <>
                                                <Archive className="h-4 w-4" />
                                                Archive
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => setDeleteOpen(true)}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    <CardDescription>
                        {new Date(batch.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}
                        {totalCount > 1 && (
                            <span className="ml-2 text-muted-foreground">
                                · {totalCount} assets
                            </span>
                        )}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {/* ---- PROGRESS GRID (rendering) or GALLERY GRID (done) ---- */}
                    {hasMultipleJobs ? (
                        <div className="grid grid-cols-5 grid-rows-2 gap-1.5">
                            {jobs.map((job) => {
                                const jobDone = job.status === "done";
                                const jobFailed = job.status === "failed";
                                const jobRendering =
                                    job.status === "rendering" ||
                                    job.status === "processing" ||
                                    job.status === "generating_assets";
                                const isVideo = job.type === "video";

                                return (
                                    <button
                                        key={job.id}
                                        onClick={() => {
                                            if (jobDone) setPreviewAsset(job);
                                            else if (jobFailed)
                                                setErrorDetail(
                                                    job.error_message || "An unknown error occurred."
                                                );
                                        }}
                                        className={`relative aspect-square rounded-md border transition-all overflow-hidden ${jobDone
                                                ? "border-success/30 bg-success/5 hover:border-success cursor-pointer"
                                                : jobFailed
                                                    ? "border-destructive/30 bg-destructive/5 hover:border-destructive cursor-pointer"
                                                    : jobRendering
                                                        ? "border-brand/20 bg-brand/5"
                                                        : "border-border bg-muted/30"
                                            }`}
                                    >
                                        {/* Video badge overlay — always visible */}
                                        {isVideo && (
                                            <div className="absolute top-0.5 right-0.5 z-20">
                                                <Video className="h-3 w-3 text-brand" />
                                            </div>
                                        )}

                                        {/* States */}
                                        {jobRendering && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Loader2 className="h-4 w-4 animate-spin text-brand" />
                                            </div>
                                        )}

                                        {jobDone && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                {job.result_url && isVideo ? (
                                                    <Play className="h-4 w-4 text-success" />
                                                ) : job.result_url && !isVideo ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img
                                                        src={job.result_url}
                                                        alt={`Asset ${job.id}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <Check className="h-4 w-4 text-success" />
                                                )}
                                            </div>
                                        )}

                                        {jobFailed && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <X className="h-4 w-4 text-destructive" />
                                            </div>
                                        )}

                                        {!jobRendering && !jobDone && !jobFailed && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[10px] text-muted-foreground">
                                                    {isVideo ? (
                                                        <Video className="h-3 w-3" />
                                                    ) : (
                                                        <Image className="h-3 w-3" />
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        /* Single job fallback */
                        <div className="flex items-center gap-2">
                            {isRendering && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Loader2 className="h-3 w-3 animate-spin text-brand" />
                                    Rendering in progress…
                                </p>
                            )}

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
                                            Download
                                        </a>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="gap-1.5"
                                        onClick={() => setPreviewAsset(primaryJob)}
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                        Preview
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
                                    Error Log
                                </Button>
                            )}

                            {batchStatus === "pending" && (
                                <p className="text-xs text-muted-foreground truncate">
                                    Waiting to start…
                                </p>
                            )}
                        </div>
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
                                ? "Video preview — starts muted"
                                : "Image preview"}
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
                                    Download
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
                            Render Failed
                        </DialogTitle>
                        <DialogDescription>
                            Something went wrong during asset generation
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3">
                        <p className="text-sm text-foreground">{errorDetail}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        If the problem persists, try reducing the duration or changing the
                        output format, then re-submit from the Studio.
                    </p>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation AlertDialog */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete batch permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong>{batch.project_name}</strong>,
                            all {totalCount} assets, and uploaded product images from storage.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    Deleting…
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete Everything
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
