export const dynamic = 'force-dynamic';

import React from "react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Filter, Ticket } from "lucide-react";
import { BugTable } from "@/components/admin/BugTable";

export default async function GlobalSupportDashboard({
    params,
    searchParams
}: {
    params: any;
    searchParams: any;
}) {
    const p = await Promise.resolve(params);
    const sp = await Promise.resolve(searchParams);

    const secretRoute = p.admin_route;

    // Date Filters
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const defaultEnd = now.toISOString().split("T")[0];

    const startDateStr = sp?.startDate || defaultStart;
    const endDateStr = sp?.endDate || defaultEnd;

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const statusFilter = sp?.status || "all";
    const categoryFilter = sp?.category || "all";

    // Build Where Clause
    const whereClause: any = {
        createdAt: { gte: startDate, lte: endDate }
    };

    if (statusFilter !== "all") {
        whereClause.status = statusFilter;
    }

    // Since Category is inside the JSON-stringified message right now, we can't easily filter it at the SQL level.
    // We will do a Prisma query, then filter in memory if category filter is active. It's an admin panel, so it's fine.
    const rawBugs = await prisma.bugReport.findMany({
        where: whereClause,
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: "desc" }
    });

    const bugs = rawBugs.filter(bug => {
        if (categoryFilter === "all") return true;
        const msg = bug.message;
        let category = "N/A";
        const catMatch = msg.match(/Category:\s*(.+)/);
        if (catMatch) category = catMatch[1].toLowerCase();
        return category === categoryFilter.toLowerCase();
    });

    return (
        <div className="p-8 pb-32 max-w-7xl mx-auto space-y-8 font-sans">
            <div className="flex items-center gap-4 mb-4">
                <Link href={`/${secretRoute}/analytics`} className="p-2 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                            Global Support Desk
                        </h1>
                        <p className="text-sm text-zinc-400 mt-1">Manage, categorize, and resolve incoming platform bug reports and routing anomalies.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-sm font-medium border border-emerald-500/20">
                        <Ticket className="w-4 h-4" /> {bugs.length} Issues Target
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-end shadow-lg relative overflow-hidden">
                <div className="absolute opacity-5 -right-10 -bottom-10 pointer-events-none">
                    <Filter className="w-64 h-64" />
                </div>

                <form method="GET" className="flex flex-wrap items-end gap-5 flex-1 relative z-10 w-full">
                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                        <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Start Date</label>
                        <input name="startDate" type="date" defaultValue={startDateStr} className="bg-black/50 border border-zinc-800/80 text-white px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-zinc-500 transition-colors" />
                    </div>
                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                        <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">End Date</label>
                        <input name="endDate" type="date" defaultValue={endDateStr} className="bg-black/50 border border-zinc-800/80 text-white px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-zinc-500 transition-colors" />
                    </div>
                    <div className="flex flex-col gap-1.5 w-[160px]">
                        <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Status</label>
                        <select name="status" defaultValue={statusFilter} className="bg-black/50 border border-zinc-800/80 text-white px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-zinc-500 transition-colors appearance-none">
                            <option value="all">All States</option>
                            <option value="open">Open</option>
                            <option value="in progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5 w-[160px]">
                        <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Category</label>
                        <select name="category" defaultValue={categoryFilter} className="bg-black/50 border border-zinc-800/80 text-white px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-zinc-500 transition-colors appearance-none">
                            <option value="all">All Categories</option>
                            <option value="rendu">Rendu (Rendering)</option>
                            <option value="paiement">Paiement (Billing)</option>
                            <option value="affichage">Affichage (UI)</option>
                            <option value="autre">Autre (Other)</option>
                        </select>
                    </div>
                    <button type="submit" className="bg-white text-black px-5 py-2 hover:-translate-y-0.5 font-semibold text-sm rounded-xl hover:bg-zinc-200 transition-all shadow-md active:translate-y-0 ml-auto md:ml-0">
                        Filter Queries
                    </button>
                    <Link href={`/${secretRoute}/analytics/support`} className="border border-zinc-700 text-zinc-300 px-5 py-2 text-sm rounded-xl hover:bg-zinc-800 transition-all">
                        Reset
                    </Link>
                </form>
            </div>

            <BugTable bugs={bugs as any} secretRoute={secretRoute} isGlobal={true} />
        </div>
    );
}
