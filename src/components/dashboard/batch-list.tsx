"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BatchCard, type Batch, type Job } from "./batch-card";

interface BatchListProps {
    initialBatches: Batch[];
}

export function BatchList({ initialBatches }: BatchListProps) {
    const [batches, setBatches] = useState<Batch[]>(initialBatches);
    const supabase = createClient();

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
