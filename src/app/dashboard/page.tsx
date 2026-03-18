export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Clock, CheckCircle, AlertCircle, ArrowRight, FolderOpen } from "lucide-react";
import { AnalyzeUrlForm } from "@/components/dashboard/AnalyzeUrlForm";

const STATUS_ICONS = {
    done: CheckCircle,
    manual_fallback: CheckCircle,
    analyzing: Clock,
    pending: Clock,
    failed: AlertCircle,
} as const;

export default async function DashboardHomePage() {
    const session = await auth();
    const userId = session?.user?.id!;
    const firstName = session?.user?.name?.split(" ")[0] ?? null;

    const recentProjects = await prisma.storeAnalysis.findMany({
        where: { userId },
        include: { _count: { select: { competitors: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
    });

    return (
        <div className="max-w-3xl mx-auto py-8 px-2 space-y-10">

            {/* ── Hero section ──────────────────────────────────── */}
            <div className="space-y-2">
                <p className="text-xs text-amber-500 font-semibold tracking-widest uppercase">
                    {firstName ? `Bonjour, ${firstName}` : "Lumina Spy"}
                </p>
                <h1 className="text-3xl font-bold tracking-tight">
                    Analysez vos concurrents.
                    <br />
                    <span className="text-amber-400">Clonez leurs meilleures publicités.</span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-lg">
                    Entrez l&apos;URL d&apos;une boutique — Lumina analyse les concurrents,
                    extrait leurs créatives et génère des variantes pour votre marque.
                </p>
            </div>

            {/* ── URL Input card ────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3 shadow-[0_0_40px_rgba(245,158,11,0.04)] backdrop-blur-sm">
                <label className="text-xs text-muted-foreground font-medium">
                    URL de votre boutique
                </label>
                <AnalyzeUrlForm />
                <p className="text-xs text-muted-foreground/60">
                    Ex: monsite.com, ma-boutique.myshopify.com, etc.
                </p>
            </div>

            {/* ── Recent projects ───────────────────────────────── */}
            {recentProjects.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Projets récents
                        </h2>
                        <Link
                            href="/dashboard/projects"
                            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                        >
                            Voir tout <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {recentProjects.map((project) => {
                            const status = project.status as keyof typeof STATUS_ICONS;
                            const StatusIcon = STATUS_ICONS[status] ?? Clock;
                            const isDone = status === "done" || status === "manual_fallback";

                            return (
                                <Link
                                    key={project.id}
                                    href={`/dashboard/projects/${project.id}`}
                                    className="group block rounded-xl border border-border bg-card p-4 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all duration-200"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <StatusIcon
                                                className={`h-4 w-4 ${isDone ? "text-amber-500" : "text-muted-foreground"}`}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate group-hover:text-amber-400 transition-colors">
                                                {project.storeName ?? project.storeUrl}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                {project.niche ?? project.productCategory ?? project.storeUrl}
                                            </p>
                                            <p className="text-xs text-muted-foreground/60 mt-1.5">
                                                {project._count.competitors} concurrent{project._count.competitors !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Empty state ───────────────────────────────────── */}
            {recentProjects.length === 0 && (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/5 p-10 flex flex-col items-center text-center gap-4">
                    <FolderOpen className="h-10 w-10 text-muted-foreground/20" />
                    <div>
                        <p className="font-medium text-sm">Aucun projet pour l&apos;instant</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Entrez l&apos;URL de votre boutique ci-dessus pour commencer.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
