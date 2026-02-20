"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BatchCard, type Batch, type Job } from "./batch-card";

/** How often to poll AWS for render progress (ms) */
const POLL_INTERVAL_MS = 8_000;

interface BatchListProps {
    initialBatches: Batch[];
}

export function BatchList({ initialBatches }: BatchListProps) {
    const [batches, setBatches] = useState<Batch[]>(initialBatches);
    const supabase = createClient();
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Supabase Realtime: instant UI updates when DB rows change ──
    useEffect(() => {
        const channel = supabase
            .channel("job-updates")
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "jobs",
                },
                (payload) => {
                    const updatedJob = payload.new as Job & { batch_id: string };

                    setBatches((prev) =>
                        prev.map((batch) => {
                            if (batch.id !== updatedJob.batch_id) return batch;

                            const updatedJobs = batch.jobs.map((job) =>
                                job.id === updatedJob.id ? { ...job, ...updatedJob } : job
                            );

                            const allDone = updatedJobs.every((j) => j.status === "done");
                            const anyFailed = updatedJobs.some((j) => j.status === "failed");
                            const newBatchStatus = allDone
                                ? "done"
                                : anyFailed
                                    ? "failed"
                                    : "processing";

                            return {
                                ...batch,
                                jobs: updatedJobs,
                                status: newBatchStatus,
                            };
                        })
                    );
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "jobs",
                },
                (payload) => {
                    const newJob = payload.new as Job & { batch_id: string };

                    setBatches((prev) =>
                        prev.map((batch) => {
                            if (batch.id !== newJob.batch_id) return batch;
                            if (batch.jobs.some((j) => j.id === newJob.id)) return batch;
                            return {
                                ...batch,
                                jobs: [...batch.jobs, newJob],
                                status: "processing",
                            };
                        })
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    // ── Status Poller: calls /api/render/status for every in-flight job ──
    const pollInFlightJobs = useCallback(async () => {
        // Collect all jobs that are still rendering
        const inFlightJobs: { jobId: string; batchId: string }[] = [];
        for (const batch of batches) {
            for (const job of batch.jobs) {
                if (
                    job.status === "rendering" ||
                    job.status === "processing" ||
                    job.status === "generating_assets"
                ) {
                    inFlightJobs.push({ jobId: job.id, batchId: batch.id });
                }
            }
        }

        if (inFlightJobs.length === 0) return;

        // Poll each in-flight job (max 10 concurrent to avoid hammering)
        const batch = inFlightJobs.slice(0, 10);
        await Promise.allSettled(
            batch.map(async ({ jobId }) => {
                try {
                    const res = await fetch(`/api/render/status?jobId=${jobId}`);
                    if (!res.ok) return;
                    const data = await res.json();

                    // If the status route updated the job in DB, Realtime will
                    // push the change. But we also update local state for instant
                    // feedback in case Realtime is slow.
                    if (data.done) {
                        setBatches((prev) =>
                            prev.map((b) => ({
                                ...b,
                                jobs: b.jobs.map((j) =>
                                    j.id === jobId
                                        ? {
                                            ...j,
                                            status: data.status,
                                            result_url: data.resultUrl ?? j.result_url,
                                            error_message: data.error ?? j.error_message,
                                        }
                                        : j
                                ),
                            }))
                        );
                    }
                } catch {
                    // Swallow — next poll will retry
                }
            })
        );
    }, [batches]);

    useEffect(() => {
        // Start polling if any batch has in-flight jobs
        const hasInFlight = batches.some((b) =>
            b.jobs.some(
                (j) =>
                    j.status === "rendering" ||
                    j.status === "processing" ||
                    j.status === "generating_assets"
            )
        );

        if (hasInFlight && !pollingRef.current) {
            // Poll immediately on mount, then every POLL_INTERVAL_MS
            pollInFlightJobs();
            pollingRef.current = setInterval(pollInFlightJobs, POLL_INTERVAL_MS);
        } else if (!hasInFlight && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [batches, pollInFlightJobs]);

    // Sync with initialBatches when they change (e.g., server refetch)
    useEffect(() => {
        setBatches(initialBatches);
    }, [initialBatches]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} />
            ))}
        </div>
    );
}
