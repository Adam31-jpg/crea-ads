import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BatchList } from "@/components/dashboard/batch-list";
import type { Batch, Job } from "@/components/dashboard/batch-card";
import { Sparkles, Plus } from "lucide-react";

export default async function DashboardPage() {
    const supabase = await createClient();

    // Fetch batches with their jobs in a single query
    const { data: rawBatches, error } = await supabase
        .from("batches")
        .select(
            `
      id, project_name, status, created_at, is_archived, input_data,
      jobs (id, status, type, result_url, error_message, template_id, created_at)
    `
        )
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(20);

    // Transform to typed Batch[]
    const batches: Batch[] = (rawBatches ?? []).map((b: Record<string, unknown>) => ({
        id: b.id as string,
        project_name: b.project_name as string,
        status: b.status as string,
        created_at: b.created_at as string,
        is_archived: b.is_archived as boolean,
        input_data: b.input_data as Record<string, unknown>,
        jobs: ((b.jobs as Record<string, unknown>[]) ?? []).map((j) => ({
            id: j.id as string,
            status: j.status as string,
            type: (j.type as string) || "video",
            result_url: j.result_url as string | null,
            error_message: j.error_message as string | null,
            template_id: j.template_id as string,
            created_at: j.created_at as string,
        })),
    }));

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Your Batches</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Manage and monitor your video generation batches.
                    </p>
                </div>
                <Link href="/dashboard/studio">
                    <Button>
                        <Plus className="h-4 w-4" />
                        New Batch
                    </Button>
                </Link>
            </div>

            {error && (
                <Card className="border-destructive/50">
                    <CardContent className="pt-6">
                        <p className="text-destructive text-sm">
                            Failed to load batches: {error.message}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Beautiful Empty State */}
            {batches.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 w-24 h-24 rounded-full bg-brand/10 blur-[40px]" />
                        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl border border-border bg-card">
                            <Sparkles className="h-8 w-8 text-brand" />
                        </div>
                    </div>

                    <h2 className="font-[var(--font-bodoni)] text-3xl md:text-4xl font-bold tracking-tight mb-3">
                        Create Your First Ad
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-md mb-8 leading-relaxed">
                        Transform your product into stunning video ads in minutes.
                        Upload images, choose a style, and let Lumina handle the rest.
                    </p>

                    <Link href="/dashboard/studio">
                        <Button size="lg" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create Your First Batch
                        </Button>
                    </Link>
                </div>
            )}

            {/* Batch Grid — Realtime via client component */}
            {batches.length > 0 && <BatchList initialBatches={batches} />}
        </div>
    );
}
