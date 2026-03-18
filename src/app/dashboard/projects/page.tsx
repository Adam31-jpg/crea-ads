import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye, Plus, Clock, CheckCircle, AlertCircle, Home } from "lucide-react";
import { getTranslations } from "next-intl/server";

const STATUS_ICONS = {
    done: CheckCircle,
    manual_fallback: CheckCircle,
    analyzing: Clock,
    pending: Clock,
    failed: AlertCircle,
} as const;

export default async function ProjectsPage() {
    const session = await auth();
    const t = await getTranslations("SpyMode");
    const userId = session?.user?.id!;

    const projects = await prisma.storeAnalysis.findMany({
        where: { userId },
        include: {
            _count: { select: { competitors: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    const projectsWithCounts = await Promise.all(
        projects.map(async (p) => {
            const blueprintCount = await prisma.creativeBlueprint.count({
                where: { storeAnalysisId: p.id },
            });
            const jobCount = await prisma.job.count({
                where: {
                    source: "spy",
                    blueprint: { storeAnalysisId: p.id },
                },
            });
            return { ...p, blueprintCount, jobCount };
        }),
    );

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                        <Eye className="h-6 w-6 text-amber-500" />
                        {t("title")}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
                </div>
                <Link href="/dashboard">
                    <Button className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black border-none gap-2">
                        <Plus className="h-4 w-4" />
                        {t("newProject")}
                    </Button>
                </Link>
            </div>

            {projectsWithCounts.length > 0 ? (
                <div className="grid gap-3">
                    {projectsWithCounts.map((project) => {
                        const status = project.status as keyof typeof STATUS_ICONS;
                        const StatusIcon = STATUS_ICONS[status] ?? Clock;
                        const isDone = status === "done" || status === "manual_fallback";

                        return (
                            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-5 hover:border-amber-500/40 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                            <StatusIcon
                                                className={`h-5 w-5 ${isDone ? "text-amber-500" : "text-muted-foreground"}`}
                                            />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm group-hover:text-amber-400 transition-colors">
                                                {project.storeName || project.storeUrl}
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                                                {project.niche || project.productCategory || project.storeUrl}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 text-xs text-muted-foreground shrink-0">
                                        <span>
                                            <span className="font-medium text-foreground">
                                                {project._count.competitors}
                                            </span>{" "}
                                            concurrents
                                        </span>
                                        <span>
                                            <span className="font-medium text-foreground">
                                                {project.blueprintCount}
                                            </span>{" "}
                                            créatives
                                        </span>
                                        <span>
                                            <span className="font-medium text-foreground">
                                                {project.jobCount}
                                            </span>{" "}
                                            générées
                                        </span>
                                        <span className="text-muted-foreground/60">
                                            {new Date(project.createdAt).toLocaleDateString("fr-FR")}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
                        <Eye className="h-8 w-8 text-amber-500" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">{t("emptyTitle")}</h2>
                    <p className="text-muted-foreground text-sm max-w-md mb-8">{t("emptyDesc")}</p>
                    <Link href="/dashboard">
                        <Button className="bg-gradient-to-r from-amber-400 to-orange-500 text-black gap-2">
                            <Home className="h-4 w-4" />
                            Nouvelle analyse
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
