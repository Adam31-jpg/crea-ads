import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

export default async function ProjectOverviewPage({
    params,
}: {
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const storeAnalysis = await prisma.storeAnalysis.findFirst({
        where: { id: projectId, userId: session.user.id },
    });
    if (!storeAnalysis) redirect("/dashboard/projects");

    const blueprints = await prisma.creativeBlueprint.findMany({
        where: { storeAnalysisId: projectId },
        select: { id: true, creativeName: true, creativeType: true },
    });

    const jobs = await prisma.job.findMany({
        where: {
            source: "spy",
            status: "done",
            blueprintId: { in: blueprints.map(b => b.id) },
            result_url: { not: null },
        },
        select: {
            id: true,
            blueprintId: true,
            result_url: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    const CLOUDFRONT = process.env.NEXT_PUBLIC_CLOUDFRONT_URL ?? "";

    const jobsWithBlueprint = jobs.map(j => ({
        ...j,
        cfUrl: j.result_url
            ? CLOUDFRONT
                ? j.result_url.replace(/^https:\/\/[^/]+\.s3\.[^/]+\.amazonaws\.com/, CLOUDFRONT)
                : j.result_url
            : null,
        blueprint: blueprints.find(b => b.id === j.blueprintId),
    }));

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href={`/dashboard/projects/${projectId}`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Retour au projet
                </Link>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">{storeAnalysis.storeName ?? storeAnalysis.storeUrl}</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{jobs.length} créative{jobs.length !== 1 ? "s" : ""} générée{jobs.length !== 1 ? "s" : ""}</p>
                </div>
            </div>

            {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                    <p className="text-muted-foreground text-sm">Aucune créative générée pour l&apos;instant.</p>
                    <Link
                        href={`/dashboard/projects/${projectId}`}
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                        Aller au projet →
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {jobsWithBlueprint.map(job => {
                        if (!job.cfUrl) return null;
                        const downloadName = `lumina-${(job.blueprint?.creativeName ?? "creative").replace(/\s+/g, "-").toLowerCase()}.png`;

                        return (
                            <div key={job.id} className="rounded-xl border border-border bg-card overflow-hidden group hover:border-amber-500/40 transition-colors">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={job.cfUrl}
                                    alt={job.blueprint?.creativeName ?? "Generated creative"}
                                    className="w-full aspect-square object-cover"
                                />
                                <div className="p-2.5 space-y-1.5">
                                    <p className="text-xs font-medium truncate">{job.blueprint?.creativeName ?? "—"}</p>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={job.cfUrl}
                                            download={downloadName}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                                        >
                                            <Download className="h-3 w-3" />
                                            Télécharger
                                        </a>
                                        <a
                                            href={job.cfUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                                        >
                                            Ouvrir ↗
                                        </a>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
