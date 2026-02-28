"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";

interface JobProgress {
    jobId: string;
    status: string;
    /** SSE progress % if available (Remotion sends 0–100) */
    progress?: number;
}

/**
 * RenderingProgressBar — mounts a sticky notification banner while any SSE
 * job is in "rendering" state, updating in real-time as Lambda webhooks fire.
 * Disappears automatically 4 s after all jobs reach a terminal state.
 */
export function RenderingProgressBar() {
    const [jobs, setJobs] = useState<Map<string, JobProgress>>(new Map());
    const [dismissed, setDismissed] = useState(false);
    const [autoHideTimer, setAutoHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const es = new EventSource("/api/events");

        es.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data) as {
                    type: string;
                    jobId?: string;
                    status?: string;
                    progress?: number;
                };

                if (payload.type === "job_update" && payload.jobId) {
                    setDismissed(false);
                    setJobs((prev) => {
                        const next = new Map(prev);
                        next.set(payload.jobId!, {
                            jobId: payload.jobId!,
                            status: payload.status ?? "rendering",
                            progress: payload.progress,
                        });
                        return next;
                    });
                }
            } catch {
                // ignore malformed events
            }
        };

        return () => es.close();
    }, []);

    // Auto-hide 4 s after all jobs are terminal
    useEffect(() => {
        const values = Array.from(jobs.values());
        if (values.length === 0) return;

        const allTerminal = values.every(
            (j) => j.status === "done" || j.status === "failed"
        );
        if (allTerminal) {
            const t = setTimeout(() => setDismissed(true), 4000);
            setAutoHideTimer(t);
        } else if (autoHideTimer) {
            clearTimeout(autoHideTimer);
            setAutoHideTimer(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobs]);

    const values = Array.from(jobs.values());
    if (values.length === 0 || dismissed) return null;

    const rendering = values.filter((j) => j.status === "rendering").length;
    const done = values.filter((j) => j.status === "done").length;
    const failed = values.filter((j) => j.status === "failed").length;
    const total = values.length;

    // Average progress across jobs that have it
    const progressJobs = values.filter((j) => j.progress !== undefined);
    const avgProgress = progressJobs.length > 0
        ? Math.round(progressJobs.reduce((acc, j) => acc + j.progress!, 0) / progressJobs.length)
        : null;

    const pct = avgProgress ?? Math.round((done / total) * 100);

    const allDone = rendering === 0 && failed === 0;
    const anyFailed = failed > 0 && rendering === 0;

    return (
        <div className={`relative overflow-hidden rounded-xl border px-5 py-3 mb-6 flex items-center gap-4 transition-all duration-500
            ${allDone
                ? "bg-green-950/60 border-green-800/60"
                : anyFailed
                    ? "bg-red-950/60 border-red-800/60"
                    : "bg-amber-950/50 border-amber-800/60"}`
        }>
            {/* Animated progress fill */}
            <div
                className={`absolute inset-0 opacity-10 transition-all duration-700 ease-out ${allDone ? "bg-green-400" : anyFailed ? "bg-red-400" : "bg-amber-400"}`}
                style={{ transform: `scaleX(${pct / 100})`, transformOrigin: "left" }}
            />

            <div className="relative flex items-center gap-3 flex-1">
                {allDone ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                ) : anyFailed ? (
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                ) : (
                    <Loader2 className="h-5 w-5 text-amber-400 shrink-0 animate-spin" />
                )}

                <div>
                    <p className="text-sm font-semibold text-foreground leading-none mb-0.5">
                        {allDone
                            ? `✓ Batch complete — ${done} creatives ready`
                            : anyFailed
                                ? `${failed} job${failed > 1 ? "s" : ""} failed • ${done}/${total} succeeded`
                                : `Rendering ${rendering} creative${rendering > 1 ? "s" : ""}… ${done}/${total} done`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {allDone
                            ? "Scroll down to view and download your results"
                            : anyFailed
                                ? "Failed jobs can be retried from the batch card below"
                                : avgProgress !== null
                                    ? `Lambda progress: ${avgProgress}%`
                                    : "Awaiting Lambda webhook · this page updates automatically"}
                    </p>
                </div>
            </div>

            {/* Progress % badge */}
            {!allDone && !anyFailed && (
                <span className="relative text-xs font-bold text-amber-400 tabular-nums shrink-0">
                    {pct}%
                </span>
            )}

            <button
                onClick={() => setDismissed(true)}
                className="relative shrink-0 rounded-md p-1 hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
            >
                <X className="h-4 w-4 text-muted-foreground" />
            </button>
        </div>
    );
}
