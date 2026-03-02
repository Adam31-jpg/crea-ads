"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { updateBugStatus } from "@/app/[admin_route]/analytics/support/actions";

export type BugDetail = {
    id: string;
    userId: string;
    subject: string;
    message: string;
    batchId: string | null;
    status: string;
    createdAt: Date;
    user?: { email: string } | null;
};

export function BugTable({ bugs, secretRoute, isGlobal = false }: { bugs: BugDetail[], secretRoute: string, isGlobal?: boolean }) {
    const [selectedBug, setSelectedBug] = useState<BugDetail | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const parseMessage = (msg: string) => {
        let category = "N/A";
        let urgency = "N/A";
        const catMatch = msg.match(/Category:\s*(.+)/);
        if (catMatch) category = catMatch[1];
        const urgMatch = msg.match(/Urgency:\s*(.+)/);
        if (urgMatch) urgency = urgMatch[1];
        return { category, urgency };
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!selectedBug) return;
        setIsUpdating(true);
        const res = await updateBugStatus(selectedBug.id, newStatus, secretRoute);
        setIsUpdating(false);
        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success(`Ticket changed to ${newStatus}`);
            setSelectedBug({ ...selectedBug, status: newStatus });
            // Since we revalidate the layout, Next.js will refetch gracefully in background.
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">
                    {isGlobal ? "Global Support Desk" : "Support Tickets & Bug Reports"}
                </h3>
            </div>
            <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left whitespace-nowrap table-fixed">
                    <thead className="bg-zinc-800/50 border-b border-zinc-800">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-32">Date</th>
                            {isGlobal && <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-48 truncate">User Email</th>}
                            {!isGlobal && <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-1/3 truncate">Subject</th>}
                            {isGlobal && <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-32">Category</th>}
                            {isGlobal && <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-24">Urgency</th>}
                            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-40">Batch ID</th>
                            <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right w-32">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {bugs.map(bug => {
                            const { category, urgency } = parseMessage(bug.message);
                            return (
                                <tr key={bug.id} onClick={() => setSelectedBug(bug)} className="hover:bg-zinc-800/40 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4 text-sm text-zinc-400 font-mono">
                                        {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric" }).format(new Date(bug.createdAt))}
                                    </td>
                                    {isGlobal && (
                                        <td className="px-6 py-4 text-sm text-white font-medium truncate" title={bug.user?.email || "Unknown"}>
                                            <Link href={`/${secretRoute}/analytics/users/${bug.userId}`} className="underline decoration-zinc-700 underline-offset-4 hover:text-amber-400" onClick={(e) => e.stopPropagation()}>
                                                {bug.user?.email || "Unknown"}
                                            </Link>
                                        </td>
                                    )}
                                    {!isGlobal && (
                                        <td className="px-6 py-4 text-sm text-white font-medium truncate" title={bug.subject}>
                                            {bug.subject}
                                        </td>
                                    )}
                                    {isGlobal && (
                                        <td className="px-6 py-4 text-sm text-zinc-400 capitalize">{category}</td>
                                    )}
                                    {isGlobal && (
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <span className={`${urgency.toLowerCase() === "high" ? "text-red-400" : urgency.toLowerCase() === "medium" ? "text-amber-400" : "text-emerald-400"}`}>
                                                {urgency}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-sm text-zinc-500 font-mono">
                                        {bug.batchId ? (
                                            <Link href={`/${secretRoute}/analytics/users/${bug.userId}/batches/${bug.batchId}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400 transition-colors">
                                                {bug.batchId.split("-")[0]} <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </Link>
                                        ) : "N/A"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        <span className={`px-2 py-1 text-xs rounded-full border ${bug.status.toLowerCase() === "resolved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : bug.status.toLowerCase() === "in progress" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                                            {bug.status}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {bugs.length === 0 && (
                            <tr>
                                <td colSpan={isGlobal ? 6 : 4} className="px-6 py-12 text-center text-zinc-500">
                                    No support tickets found matching these filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Layer */}
            {selectedBug && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">{selectedBug.subject}</h2>
                                <p className="text-sm font-mono text-zinc-500">
                                    Ticket <span className="text-zinc-400">{selectedBug.id}</span>
                                </p>
                            </div>
                            <button onClick={() => setSelectedBug(null)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-black/40 rounded-xl border border-zinc-800/50">
                                    <span className="block text-xs text-zinc-500 uppercase font-bold mb-1">Status Mutation</span>
                                    <select
                                        disabled={isUpdating}
                                        value={selectedBug.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 appearance-none"
                                    >
                                        <option value="open">Open</option>
                                        <option value="in progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                    </select>
                                </div>
                                <div className="p-4 bg-black/40 rounded-xl border border-zinc-800/50">
                                    <span className="block text-xs text-zinc-500 uppercase font-bold mb-1">Reporter</span>
                                    <Link href={`/${secretRoute}/analytics/users/${selectedBug.userId}`} className="text-sm text-zinc-300 hover:text-white underline decoration-zinc-700 underline-offset-4 block truncate">
                                        {selectedBug.user?.email || selectedBug.userId}
                                    </Link>
                                </div>
                            </div>

                            <div className="bg-black/50 border border-zinc-800/50 rounded-xl p-5 break-words">
                                <pre className="text-sm text-zinc-300 font-sans whitespace-pre-wrap leading-relaxed outline-none">
                                    {selectedBug.message}
                                </pre>
                            </div>

                            {selectedBug.batchId && (
                                <div className="flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                                    <span className="text-sm text-emerald-400 font-medium">Batch Reference Embedded:</span>
                                    <Link href={`/${secretRoute}/analytics/users/${selectedBug.userId}/batches/${selectedBug.batchId}`} className="text-sm bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-md hover:bg-emerald-500/30 transition-colors font-mono">
                                        View Assets →
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
