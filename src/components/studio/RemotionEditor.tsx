"use client";

import React, { useEffect } from "react";
import { Player } from "@remotion/player";
import { MasterComposition } from "@/engine/compositions/MasterComposition";
import { useStudioStore } from "@/store/studio";
import { RemotionProps } from "@/engine/schema/project";
import { Loader2, ArrowLeft, Wand2, Layers2, ArrowUpToLine, ArrowDownToLine } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RemotionEditor({ jobId, initialProps }: { jobId: string; initialProps: any }) {
    const {
        props, setProps, isInitializing,
        selectedElementId, updateElementZIndex, updateLayoutConfigZIndex
    } = useStudioStore();

    useEffect(() => {
        if (initialProps) {
            setProps(initialProps as RemotionProps);
        }
    }, [initialProps, setProps]);

    if (isInitializing || !props) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-zinc-950 text-white">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    const aspectRatio = props.layout?.aspectRatio || "9:16";
    let width = 1080;
    let height = 1920;
    if (aspectRatio === "1:1") { width = 1080; height = 1080; }
    else if (aspectRatio === "16:9") { width = 1920; height = 1080; }

    const FPS = 30;
    const DURATION = 150;

    return (
        <div className="flex h-screen w-full bg-zinc-950 text-white overflow-hidden">
            {/* Sidebar Inspector */}
            <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col z-10 shadow-xl">
                <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/50 backdrop-blur-md">
                    <Button variant="ghost" size="icon" asChild className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                        <Link href="/dashboard">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="font-semibold text-sm tracking-tight text-zinc-100">Interactive Studio</h2>
                        <p className="text-xs text-zinc-500 font-mono uppercase">{jobId.split('-')[0]}</p>
                    </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {selectedElementId ? (
                        <div className="space-y-4 animate-in fade-in zoom-in-95">
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                                <h3 className="text-sm font-semibold capitalize text-brand">
                                    {selectedElementId.replace(/_/g, ' ')}
                                </h3>
                                <span className="text-[10px] bg-brand/20 text-brand px-2 py-0.5 rounded-full">Selected</span>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                    <Layers2 className="w-4 h-4" /> Arrange (Z-Index)
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800"
                                        onClick={() => {
                                            if (['headline', 'social_proof', 'arrow', 'trust_bar', 'logo', 'features'].includes(selectedElementId)) {
                                                updateLayoutConfigZIndex(selectedElementId as any, 1);
                                            } else {
                                                updateElementZIndex(selectedElementId, 1);
                                            }
                                        }}
                                    >
                                        <ArrowUpToLine className="w-4 h-4 mr-2" />
                                        Bring Forward
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800"
                                        onClick={() => {
                                            if (['headline', 'social_proof', 'arrow', 'trust_bar', 'logo', 'features'].includes(selectedElementId)) {
                                                updateLayoutConfigZIndex(selectedElementId as any, -1);
                                            } else {
                                                updateElementZIndex(selectedElementId, -1);
                                            }
                                        }}
                                    >
                                        <ArrowDownToLine className="w-4 h-4 mr-2" />
                                        Send Backward
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-xl bg-brand/10 border border-brand/20 flex flex-col items-center justify-center text-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand">
                                <Wand2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-brand">Live Canvas Active</h3>
                                <p className="text-xs text-brand/70 mt-1">Click any Text or Logo on the canvas to inspect and modify it.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 bg-black p-8 flex items-center justify-center relative bg-[url('/noise.png')]">
                <div
                    className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border border-white/5 rounded-md"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '90vh',
                        aspectRatio: aspectRatio === "16:9" ? '16/9' : aspectRatio === "1:1" ? '1/1' : '9/16',
                        height: aspectRatio === "9:16" ? '90vh' : 'auto',
                        width: aspectRatio !== "9:16" ? '100%' : 'auto'
                    }}
                >
                    <Player
                        component={MasterComposition}
                        inputProps={props}
                        durationInFrames={DURATION}
                        fps={FPS}
                        compositionWidth={width}
                        compositionHeight={height}
                        style={{ width: '100%', height: '100%' }}
                        controls
                        autoPlay
                        loop
                    />
                </div>

                {/* Reset Controls Overlay */}
                <div className="absolute top-6 right-6 flex items-center gap-3">
                    <Button variant="outline" size="sm" className="border-zinc-800 bg-zinc-900/80 backdrop-blur text-zinc-300 hover:text-white hover:bg-zinc-800" onClick={() => setProps(initialProps as RemotionProps)}>
                        <Layers2 className="w-4 h-4 mr-2" />
                        Reset to AI Original
                    </Button>
                </div>
            </div>
        </div>
    );
}
