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

    useEffect(() => {
        // Subscribe to job status changes via Supabase Realtime
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

                            // Update the matching job in this batch
                            const updatedJobs = batch.jobs.map((job) =>
                                job.id === updatedJob.id ? { ...job, ...updatedJob } : job
                            );

                            // Also update batch-level status based on jobs
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
                            // Avoid duplicates
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} />
            ))}
        </div>
    );
}
