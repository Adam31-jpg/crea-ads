import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BatchList } from "@/components/dashboard/batch-list";
import type { Batch, Job } from "@/components/dashboard/batch-card";
import { Sparkles, Plus, Archive, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightsBar } from "@/components/dashboard/insights-bar";

import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
    const supabase = await createClient();
    const t = await getTranslations("Dashboard");

    const { data: { user } } = await supabase.auth.getUser();

    // Fetch batches with their jobs in a single query
    // We fetch EVERYTHING now so we can split them into tabs
    const { data: rawBatches, error } = await supabase
        .from("batches")
        .select(
            `
      id, project_name, status, created_at, is_archived, input_data,
      jobs (id, status, type, result_url, error_message, template_id, created_at)
    `
        )
        .order("created_at", { ascending: false })
        .limit(50);

    // Transform to typed Batch[]
    const allBatches: Batch[] = (rawBatches ?? []).map((b: Record<string, unknown>) => ({
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

    const activeBatches = allBatches.filter(b => !b.is_archived);
    const archivedBatches = allBatches.filter(b => b.is_archived);

    // Calculate Insights perfectly efficiently from the already fetched jobs
    let totalSuccess = 0;
    let totalFailed = 0;

    allBatches.forEach(batch => {
        batch.jobs.forEach(job => {
            if (job.status === "done") totalSuccess++;
            else if (job.status === "failed" || job.status === "error") totalFailed++;
        });
    });

    const totalAttempted = totalSuccess + totalFailed;
    const hoursSaved = (totalSuccess * 300) / 3600;

    // Strict logic for success rate requested by user (Math.floor if any errors exist)
    let successRate = 0;
    if (totalAttempted > 0) {
        const rawRate = (totalSuccess / totalAttempted) * 100;
        successRate = totalFailed > 0 ? Math.floor(rawRate) : 100;
    }

    let producerTier: "beginner" | "expert" | "factory" = "beginner";
    if (totalSuccess >= 201) producerTier = "factory";
    else if (totalSuccess >= 51) producerTier = "expert";

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t("title", { name: user?.user_metadata?.first_name || t("titleFallback") })}</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {t("subtitle")}
                    </p>
                </div>
                <Link href="/dashboard/studio">
                    <Button className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none shadow-[0_0_15px_rgba(245,158,11,0.3)] gap-2">
                        <Plus className="h-4 w-4" />
                        {t("newProject")}
                    </Button>
                </Link>
            </div>

            <InsightsBar
                hoursSaved={hoursSaved}
                totalSuccess={totalSuccess}
                successRate={successRate}
                producerTier={producerTier}
            />

            {error && (
                <Card className="border-destructive/50 mb-8">
                    <CardContent className="pt-6">
                        <p className="text-destructive text-sm">
                            Erreur de chargement: {error.message}
                        </p>
                    </CardContent>
                </Card>
            )}

            {!error && allBatches.length > 0 && (
                <Tabs defaultValue="active" className="space-y-6">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                        <TabsList className="bg-transparent border-none p-0 h-auto">
                            <TabsTrigger
                                value="active"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-amber-500 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none px-4 pb-2 pt-2"
                            >
                                <Layers className="h-4 w-4 mr-2" />
                                {t("tabs.active", { count: activeBatches.length })}
                            </TabsTrigger>
                            <TabsTrigger
                                value="archived"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-amber-500 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none px-4 pb-2 pt-2"
                            >
                                <Archive className="h-4 w-4 mr-2" />
                                {t("tabs.archived", { count: archivedBatches.length })}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="active" className="mt-0 outline-none">
                        {activeBatches.length > 0 ? (
                            <BatchList initialBatches={activeBatches} />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg bg-muted/10">
                                <Layers className="h-8 w-8 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="font-semibold text-lg">{t("empty.activeTitle")}</h3>
                                <p className="text-muted-foreground text-sm max-w-sm mt-2">
                                    {t("empty.activeDesc")}
                                </p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="archived" className="mt-0 outline-none">
                        {archivedBatches.length > 0 ? (
                            <BatchList initialBatches={archivedBatches} showUnarchive />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg bg-muted/10">
                                <Archive className="h-8 w-8 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="font-semibold text-lg">{t("empty.archivedTitle")}</h3>
                                <p className="text-muted-foreground text-sm max-w-sm mt-2">
                                    {t("empty.archivedDesc")}
                                </p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            {/* Beautiful Empty State (when NO batches exist at all) */}
            {allBatches.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 w-24 h-24 rounded-full bg-amber-500/10 blur-[40px]" />
                        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl border border-amber-500/20 bg-card shadow-[0_0_20px_rgba(245,158,11,0.05)]">
                            <Sparkles className="h-8 w-8 text-amber-500" />
                        </div>
                    </div>

                    <h2 className="font-[var(--font-bodoni)] text-3xl md:text-4xl font-bold tracking-tight mb-3 text-foreground">
                        {t("empty.noBatchesTitle")}
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-md mb-8 leading-relaxed">
                        {t("empty.noBatchesDesc")}
                    </p>

                    <Link href="/dashboard/studio">
                        <Button size="lg" className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none shadow-[0_0_15px_rgba(245,158,11,0.4)] gap-2">
                            <Plus className="h-4 w-4" />
                            {t("empty.generateFirst")}
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
