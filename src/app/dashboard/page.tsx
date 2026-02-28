import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BatchList } from "@/components/dashboard/batch-list";
import { RenderingProgressBar } from "@/components/dashboard/rendering-progress-bar";
import type { Batch } from "@/components/dashboard/batch-card";
import { Sparkles, Plus, Archive, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightsBar } from "@/components/dashboard/insights-bar";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
    const session = await auth();
    const t = await getTranslations("Dashboard");
    const userId = session?.user?.id!;

    // Fetch batches with their jobs in a single query
    const rawBatches = await prisma.batch.findMany({
        where: { userId },
        include: { jobs: { select: { id: true, status: true, result_url: true, metadata: true, type: true, error_message: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    // Transform to typed Batch[]
    const allBatches: Batch[] = rawBatches.map((b) => {
        const meta = (b.metadata as Record<string, unknown>) ?? {};
        return {
            id: b.id,
            project_name: (meta.project_name as string) || "Untitled",
            status: b.status,
            created_at: b.createdAt.toISOString(),
            is_archived: !!(meta.is_archived as boolean),
            input_data: meta,
            jobs: b.jobs.map((j) => {
                return {
                    id: j.id,
                    status: j.status,
                    // Read from the Prisma `type` column set at job creation time.
                    // Fallback to metadata.concept.type for legacy rows created before
                    // the column was populated.
                    type: j.type || ((j.metadata as Record<string, unknown>)?.concept as Record<string, unknown>)?.type as string || "image",
                    result_url: j.result_url ?? null,
                    error_message: j.error_message ?? null,
                    template_id: "",
                    created_at: "",
                };
            }),
        };
    });

    const activeBatches = allBatches.filter((b) => !b.is_archived);
    const archivedBatches = allBatches.filter((b) => b.is_archived);

    let totalSuccess = 0;
    let totalFailed = 0;
    allBatches.forEach((batch) => {
        batch.jobs.forEach((job) => {
            if (job.status === "done") totalSuccess++;
            else if (job.status === "failed") totalFailed++;
        });
    });
    const totalAttempted = totalSuccess + totalFailed;
    const hoursSaved = (totalSuccess * 300) / 3600;
    let successRate = 0;
    if (totalAttempted > 0) {
        const rawRate = (totalSuccess / totalAttempted) * 100;
        successRate = totalFailed > 0 ? Math.floor(rawRate) : 100;
    }
    let producerTier: "beginner" | "expert" | "factory" = "beginner";
    if (totalSuccess >= 201) producerTier = "factory";
    else if (totalSuccess >= 51) producerTier = "expert";

    const firstName = session?.user?.name?.split(" ")[0] || null;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t("title", { name: firstName || t("titleFallback") })}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
                </div>
                <Link href="/dashboard/studio">
                    <Button className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none shadow-[0_0_15px_rgba(245,158,11,0.3)] gap-2">
                        <Plus className="h-4 w-4" />
                        {t("newProject")}
                    </Button>
                </Link>
            </div>

            <InsightsBar hoursSaved={hoursSaved} totalSuccess={totalSuccess} successRate={successRate} producerTier={producerTier} />

            {/* Live render progress — only visible while Lambda jobs are in-flight */}
            <RenderingProgressBar />

            {allBatches.length > 0 && (
                <Tabs defaultValue="active" className="space-y-6">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                        <TabsList className="bg-transparent border-none p-0 h-auto">
                            <TabsTrigger value="active" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-amber-500 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none px-4 pb-2 pt-2">
                                <Layers className="h-4 w-4 mr-2" />
                                {t("tabs.active", { count: activeBatches.length })}
                            </TabsTrigger>
                            <TabsTrigger value="archived" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-amber-500 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none px-4 pb-2 pt-2">
                                <Archive className="h-4 w-4 mr-2" />
                                {t("tabs.archived", { count: archivedBatches.length })}
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <TabsContent value="active" className="mt-0 outline-none">
                        {activeBatches.length > 0 ? <BatchList initialBatches={activeBatches} /> : (
                            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg bg-muted/10">
                                <Layers className="h-8 w-8 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="font-semibold text-lg">{t("empty.activeTitle")}</h3>
                                <p className="text-muted-foreground text-sm max-w-sm mt-2">{t("empty.activeDesc")}</p>
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="archived" className="mt-0 outline-none">
                        {archivedBatches.length > 0 ? <BatchList initialBatches={archivedBatches} showUnarchive /> : (
                            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg bg-muted/10">
                                <Archive className="h-8 w-8 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="font-semibold text-lg">{t("empty.archivedTitle")}</h3>
                                <p className="text-muted-foreground text-sm max-w-sm mt-2">{t("empty.archivedDesc")}</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}
            {allBatches.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 w-24 h-24 rounded-full bg-amber-500/10 blur-[40px]" />
                        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl border border-amber-500/20 bg-card shadow-[0_0_20px_rgba(245,158,11,0.05)]">
                            <Sparkles className="h-8 w-8 text-amber-500" />
                        </div>
                    </div>
                    <h2 className="font-[var(--font-bodoni)] text-3xl md:text-4xl font-bold tracking-tight mb-3 text-foreground">{t("empty.noBatchesTitle")}</h2>
                    <p className="text-muted-foreground text-sm max-w-md mb-8 leading-relaxed">{t("empty.noBatchesDesc")}</p>
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
