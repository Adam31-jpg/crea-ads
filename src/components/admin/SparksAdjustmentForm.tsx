"use client";

import React, { useState } from "react";
import { adjustSparksAction } from "@/app/[admin_route]/analytics/users/[id]/actions";
import { toast } from "sonner";
import { Zap } from "lucide-react";

export function SparksAdjustmentForm({ userId, currentSparks, secretRoute, userName }: { userId: string, currentSparks: number, secretRoute: string, userName: string }) {
    const [amount, setAmount] = useState<string>("50");
    const [isPending, setIsPending] = useState(false);

    const handleAdjust = async (isAdding: boolean) => {
        const val = parseInt(amount);
        if (isNaN(val) || val <= 0) {
            toast.error("Please enter a valid amount.");
            return;
        }

        setIsPending(true);
        const finalAmount = isAdding ? val : -val;

        // Optimistic Toast Notification
        const toastId = toast.loading(`Processing ${isAdding ? "addition" : "removal"} of ${val} Sparks...`);

        const res = await adjustSparksAction(userId, finalAmount, secretRoute);

        if (res.error) {
            toast.error(res.error, { id: toastId });
        } else {
            toast.success(`Successfully ${isAdding ? "added" : "removed"} ${val} Sparks.`, { id: toastId });
            setAmount("50");
        }
        setIsPending(false);
    };

    return (
        <div className="bg-zinc-900 border border-red-900/50 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between h-full">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transform translate-x-4 -translate-y-4">
                <Zap className="w-32 h-32 text-red-500" />
            </div>

            <div>
                <h3 className="text-red-400 font-bold mb-1 flex items-center gap-2">
                    <Zap className="w-5 h-5 fill-red-400" />
                    GOD MODE CONTROLS
                </h3>
                <p className="text-zinc-500 text-sm mb-6 max-w-[85%]">
                    Bypass billing engines to manually hydrate or deduct user Sparks. Audited actions apply strictly to <span className="text-zinc-300 font-mono bg-zinc-800 px-1 rounded">{userId}, {userName}</span>.
                </p>
            </div>

            <div className="mt-auto space-y-4">
                <div className="flex flex-col gap-3 relative z-10 w-full">
                    <div className="relative w-full group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                            <Zap className="w-4 h-4" />
                        </span>
                        <input
                            type="number"
                            min="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-white pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 w-full font-mono transition-all"
                            placeholder="Amount"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-full">
                        <button
                            disabled={isPending}
                            onClick={() => handleAdjust(true)}
                            className="flex-1 justify-center bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:opacity-50 text-sm flex items-center gap-1"
                        >
                            <span className="text-lg leading-none mb-0.5">+</span> Add Sparks
                        </button>
                        <button
                            disabled={isPending}
                            onClick={() => handleAdjust(false)}
                            className="flex-1 justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:opacity-50 text-sm flex items-center gap-1"
                        >
                            <span className="text-lg leading-none mb-0.5">-</span> Remove
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500 font-mono tracking-wide pt-2 border-t border-zinc-800/50">
                    <span>CURRENT LIVE BALANCE:</span>
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold text-sm">
                        {currentSparks} Sparks
                    </span>
                </div>
            </div>
        </div>
    );
}
