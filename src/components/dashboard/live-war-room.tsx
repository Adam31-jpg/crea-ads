"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, CheckCircle2, XCircle, Clock, PlayCircle, Wand2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Job {
    id: string;
    status: string;
    result_url: string | null;
    error_message: string | null;
    createdAt: string;
    type: string;
    metadata: any;
}

interface Batch {
    id: string;
    status: string;
    createdAt: string;
    metadata: any;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function JobStatusRow({ job }: { job: Job }) {
    // SWR polling every 3 seconds only if not terminal
    const isTerminal = job.status === "done" || job.status === "failed";

    // We poll to check on AWS Lambda render progress or Redis Queue Position
    const { data: statusData } = useSWR(
        !isTerminal ? `/api/render/status?jobId=${job.id}` : null,
        fetcher,
        {
            refreshInterval: 3000,
            revalidateOnFocus: false,
        }
    );

    // Reconcile status
    const currentStatus = statusData?.status || job.status;
    const progress = statusData?.progress || 0;
    const resultUrl = statusData?.resultUrl || job.result_url;
    const errorMsg = statusData?.error || job.error_message;
    const queuePosition = statusData?.queuePosition ?? null;
    const isThrottled = statusData?.isThrottled;

    const renderStatusBadge = () => {
        switch (currentStatus) {
            case "done":
                return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="w-3 h-3" /> Ready</Badge>;
            case "failed":
                return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
            case "rendering":
                return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Rendering {Math.round(progress * 100)}%</Badge>;
            case "queued":
            default:
                return (
                    <Badge variant="outline" className="text-zinc-400 gap-1">
                        <Clock className="w-3 h-3" />
                        {queuePosition !== null ? `Enqueued (Pos: ${queuePosition})` : "Queued..."}
                    </Badge>
                );
        }
    };

    return (
        <Card className="border-zinc-800/50 bg-black/40 overflow-hidden relative">
            <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-medium tracking-tight">
                            {job.metadata?.concept?.headline || job.type + " Output"}
                        </CardTitle>
                        <CardDescription className="text-zinc-500 flex items-center gap-2 mt-1">
                            <span className="uppercase text-[10px] bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300 tracking-wider">
                                {job.type}
                            </span>
                            <span className="text-xs">
                                Asset ID: {job.id.slice(0, 8)}
                            </span>
                        </CardDescription>
                    </div>
                    <div>{renderStatusBadge()}</div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
                {currentStatus === "rendering" && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-zinc-400">
                            <span>{isThrottled ? "AWS Quota Throttled: Retrying..." : "Media Engine Matrix computing..."}</span>
                        </div>
                        <Progress value={progress * 100} className="h-1.5 bg-zinc-900"
                            style={{
                                "--progress-background": "linear-gradient(90deg, #3b82f6, #8b5cf6)"
                            } as any} />
                    </div>
                )}
                {currentStatus === "failed" && errorMsg && (
                    <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                        {errorMsg}
                    </div>
                )}
                {currentStatus === "done" && resultUrl && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                            variant="default"
                            size="sm"
                            className="bg-brand text-brand-foreground hover:bg-brand/90"
                            onClick={() => window.open(resultUrl, "_blank")}
                        >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            View Output
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="border-brand/40 text-brand bg-brand/5 hover:bg-brand/10 hover:text-brand"
                        >
                            <Link href={`/studio/editor/${job.id}`}>
                                <Wand2 className="w-4 h-4 mr-2" />
                                Edit in Studio
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-zinc-700 hover:bg-zinc-800"
                            onClick={() => {
                                const a = document.createElement("a");
                                a.href = resultUrl;
                                a.download = `crea-ads-${job.id.slice(0, 8)}.mp4`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            }}
                        >
                            Download
                        </Button>
                    </div>
                )}
            </CardContent>
            {/* Visual glow on edges to signify activity */}
            {currentStatus === "rendering" && (
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
            )}
            {currentStatus === "done" && (
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            )}
        </Card>
    );
}

export default function LiveWarRoom({ batch, initialJobs }: { batch: Batch; initialJobs: Job[] }) {
    const isTerminal = batch.status === "done" || batch.status === "failed";
    const specs = batch.metadata?.inputData || {};

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div>
                    <h2 className="text-xl font-semibold mb-4 text-zinc-100 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-brand" /> Live Render Matrix
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {initialJobs.map((job) => (
                            <JobStatusRow key={job.id} job={job} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <Card className="border-zinc-800 bg-zinc-950/50">
                    <CardHeader>
                        <CardTitle className="text-base text-zinc-300">Target Specifications</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="flex justify-between border-b border-zinc-800 pb-2">
                            <span className="text-zinc-500">Format Matrix</span>
                            <span className="text-zinc-200">{specs.format || "1080x1920"} @ {specs.fps || 30}fps</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-800 pb-2">
                            <span className="text-zinc-500">Video Duration</span>
                            <span className="text-zinc-200">{specs.durationSec || 6} Seconds</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-800 pb-2">
                            <span className="text-zinc-500">Aesthetic Lens</span>
                            <span className="text-zinc-200 capitalize">{specs.theme || "Luxe-Sombre"}</span>
                        </div>
                        <div className="flex flex-col gap-2 pt-2">
                            <span className="text-zinc-500">Engine Color Palette</span>
                            <div className="flex gap-2">
                                {specs.colors && Object.entries(specs.colors).map(([key, hex]: any) => (
                                    <div key={key} className="w-8 h-8 rounded-full shadow-inner border border-zinc-700" style={{ backgroundColor: hex }} title={hex} />
                                ))}
                                {!specs.colors && <span className="text-zinc-700 text-xs">Unspecified</span>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
