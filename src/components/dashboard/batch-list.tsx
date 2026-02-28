"use client";

import { useEffect, useState } from "react";
import { BatchCard, type Batch, type Job } from "./batch-card";

interface BatchListProps {
    initialBatches: Batch[];
    showUnarchive?: boolean;
}

export function BatchList({ initialBatches, showUnarchive }: BatchListProps) {
    const [batches, setBatches] = useState<Batch[]>(initialBatches);

    // ── Server-Sent Events: real-time job status updates ──────────────────────
    useEffect(() => {
        const eventSource = new EventSource("/api/events");

        eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);

                // Handle job_update events: update job status in the batch list
                if (payload.type === "job_update") {
                    const { jobId, status, result_url } = payload as {
                        jobId: string;
                        status: string;
                        result_url?: string;
                    };

                    setBatches((prev) =>
                        prev.map((batch) => {
                            if (!batch.jobs.some((j) => j.id === jobId)) return batch;

                            const updatedJobs = batch.jobs.map((job) =>
                                job.id === jobId
                                    ? { ...job, status, result_url: result_url ?? job.result_url }
                                    : job
                            );

                            const allDone = updatedJobs.every((j) => j.status === "done");
                            const anyFailed = updatedJobs.some((j) => j.status === "failed");
                            const newBatchStatus = allDone ? "done" : anyFailed ? "failed" : "processing";

                            return { ...batch, jobs: updatedJobs, status: newBatchStatus };
                        })
                    );
                }

                // batch_done event signals the batch is fully terminal
                if (payload.type === "batch_done") {
                    const { batchId, status } = payload as { batchId: string; status: string };
                    setBatches((prev) =>
                        prev.map((b) => (b.id === batchId ? { ...b, status } : b))
                    );
                }
            } catch {
                // ignore malformed events
            }
        };

        eventSource.onerror = () => {
            // Browser will auto-reconnect per SSE spec
        };

        return () => eventSource.close();
    }, []);

    // Sync with props on re-render (e.g. after archive/unarchive)
    useEffect(() => {
        setBatches(initialBatches);
    }, [initialBatches]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} showUnarchive={showUnarchive} />
            ))}
        </div>
    );
}
