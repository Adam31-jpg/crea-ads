import React from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdminBatchDetail({
    params
}: {
    params: any
}) {
    const p = await Promise.resolve(params);
    const { admin_route, id: userId, batchId } = p;

    const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        include: {
            jobs: {
                orderBy: { createdAt: "desc" }
            },
            user: { select: { email: true } }
        }
    });

    if (!batch || batch.userId !== userId) return notFound();

    const meta = (batch.metadata as Record<string, any>) || {};

    // Defensive parsing for stringified sub-objects
    const parseMeta = (field: any) => {
        if (!field) return null;
        if (typeof field === "string") {
            try { return JSON.parse(field); } catch { return null; }
        }
        return field;
    };

    const inputData = parseMeta(meta.inputData) || meta;
    const productsObj = parseMeta(inputData.products) || parseMeta(inputData.product) || parseMeta(meta.products) || [];
    const strategyObj = parseMeta(inputData.strategy) || parseMeta(meta.strategy) || [];
    const colorsObj = parseMeta(inputData.colors) || parseMeta(meta.colors);

    const projectName = meta.project_name || meta.title || batch.id.split("-")[0];
    const format = inputData.format || meta.format || meta.render_format || "1080x1080";
    const theme = inputData.theme || meta.theme || meta.aesthetic || "Standard Lumina";

    let colors: string[] = [];
    if (Array.isArray(colorsObj)) {
        colors = colorsObj;
    } else if (colorsObj && typeof colorsObj === "object") {
        colors = Object.values(colorsObj).filter(Boolean) as string[];
    } else {
        colors = [meta.primary_color, meta.secondary_color, meta.accent_color].filter(Boolean) as string[];
    }

    const productName = productsObj?.[0]?.productName || productsObj?.[0]?.name || meta.product_name || "N/A";
    const tagline = productsObj?.[0]?.tagline || meta.tagline || meta.hook || "N/A";
    const backgroundPrompt = strategyObj?.[0]?.background_prompt || meta.background_prompt || "N/A";
    const formattedDate = batch.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

    return (
        <div className="p-8 pb-32 max-w-7xl mx-auto space-y-8 font-sans">
            <div className="flex items-center gap-4">
                <Link href={`/${admin_route}/analytics/users/${userId}`} className="p-2 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Batch {batch.id.split("-")[0]}</h1>
                    <p className="text-zinc-500 text-sm">User: {batch.user?.email || userId} &bull; {batch.createdAt.toLocaleString()}</p>
                </div>
            </div>

            <div className="flex w-full gap-8">
                {/* Visual Masonry Grid */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-6">Visual Production Grid</h3>
                        {batch.jobs.length === 0 ? (
                            <p className="text-zinc-500 text-sm py-4">No assets found in this batch.</p>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {batch.jobs.map(job => (
                                    <div key={job.id} className="relative group rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-[4/5] flex items-center justify-center">
                                        {(job as any).result_url ? (
                                            job.type === "video" ? (
                                                <video src={(job as any).result_url} controls className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={(job as any).result_url} alt="Output" className="w-full h-full object-cover" />
                                            )
                                        ) : (
                                            <p className="text-xs text-zinc-600 font-mono p-4 text-center break-all">
                                                {job.status === "failed" ? (job as any).error_message || "Render Failed" : job.status}
                                            </p>
                                        )}
                                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur text-white text-[10px] font-mono rounded">
                                            {job.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Metadata Viewer (Humanized) */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
                        <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Batch Specifications</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800/50 pb-3 gap-1">
                            <span className="text-zinc-500 text-sm whitespace-nowrap">Project Name / ID</span>
                            <span className="text-white text-sm font-mono sm:text-right break-all">{projectName}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800/50 pb-3 gap-1">
                            <span className="text-zinc-500 text-sm whitespace-nowrap">Created At</span>
                            <span className="text-white text-sm font-mono sm:text-right">{formattedDate}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800/50 pb-3 gap-1">
                            <span className="text-zinc-500 text-sm whitespace-nowrap">Format</span>
                            <span className="text-amber-400 text-sm font-mono bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 sm:w-min whitespace-nowrap">{format}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800/50 pb-3 gap-1">
                            <span className="text-zinc-500 text-sm whitespace-nowrap">Aesthetic Theme</span>
                            <span className="text-white text-sm font-mono capitalize sm:text-right">{theme}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-zinc-800/50 pb-3 gap-2">
                            <span className="text-zinc-500 text-sm whitespace-nowrap">Main Colors</span>
                            <div className="flex gap-1.5 sm:justify-end">
                                {colors.length > 0 ? colors.map((c: string, i: number) => (
                                    <div key={i} className="w-5 h-5 rounded-md border border-zinc-700 shadow-sm" style={{ backgroundColor: c }} title={c} />
                                )) : <span className="text-zinc-600 font-mono text-sm">None</span>}
                            </div>
                        </div>
                        <div className="flex flex-col border-b border-zinc-800/50 pb-3 gap-1">
                            <span className="text-zinc-500 text-sm">Product Details</span>
                            <span className="text-white text-sm font-medium">{productName}</span>
                        </div>
                        <div className="flex flex-col pb-3 gap-1 border-b border-zinc-800/50">
                            <span className="text-zinc-500 text-sm">Tagline / Hook</span>
                            <span className="text-zinc-300 text-sm italic">"{tagline}"</span>
                        </div>
                        <div className="flex flex-col pb-1 gap-1">
                            <span className="text-zinc-500 text-sm">Prompt Used</span>
                            <p className="text-white text-sm bg-zinc-950 p-3 rounded-xl border border-zinc-800/50 leading-relaxed font-mono">
                                {backgroundPrompt}
                            </p>
                        </div>
                    </div>


                    {/* 
                        User specified to delete the raw JSON block.
                        */}
                </div>
            </div>
        </div>
    );
}
