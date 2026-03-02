import React from "react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Decimal } from "@prisma/client/runtime/library";

export default async function AnalyticsDashboard({
    searchParams,
    params,
}: {
    searchParams: any;
    params: any;
}) {
    const sp = await Promise.resolve(searchParams);
    const p = await Promise.resolve(params);
    const secretRoute = p.admin_route;

    // Date Filter Parsing
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]; // First of month
    const defaultEnd = now.toISOString().split("T")[0];

    const startDateStr = sp?.startDate || defaultStart;
    const endDateStr = sp?.endDate || defaultEnd;
    const searchStr = sp?.query || "";
    const sortMode = sp?.sort || "profit_desc";

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999); // Include full end day

    // 1. GLOBAL STATS (Filter by Date)
    // CoGS: Sum of Job.cost_usd in date range
    const jobsInRange = await prisma.job.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        select: { cost_usd: true },
    });

    const totalCogs = jobsInRange.reduce(
        (acc, job) => acc.add(job.cost_usd || new Decimal(0)),
        new Decimal(0)
    );

    // we take the lifetime User.total_spent_usd as Gross Revenue, or mock it if strictly date-bound.
    // For now, we will query all users' total_spent_usd as LifeTime Gross Revenue.
    const allUsers = await prisma.user.findMany({
        where: searchStr ? {
            OR: [
                { email: { contains: searchStr, mode: "insensitive" } },
                { name: { contains: searchStr, mode: "insensitive" } }
            ]
        } : undefined,
        select: { id: true, email: true, total_spent_usd: true, createdAt: true, updatedAt: true },
    });

    const lifetimeGrossRevenue = allUsers.reduce(
        (acc, u) => acc.add(u.total_spent_usd || new Decimal(0)),
        new Decimal(0)
    );

    const netProfit = lifetimeGrossRevenue.sub(totalCogs);

    // 2. USER LIST
    // To get per-user COGS correctly, we group by userId
    const userCogsGroups = await prisma.job.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { cost_usd: true },
    });

    const userDict = allUsers.map(user => {
        const cogsMatch = userCogsGroups.find(g => g.userId === user.id);
        const cogs = new Decimal(cogsMatch?._sum.cost_usd || 0);
        const revenue = user.total_spent_usd || new Decimal(0);
        const profit = revenue.sub(cogs);

        return { ...user, cogs, profit };
    }).sort((a, b) => {
        if (sortMode === "activity_desc") return b.updatedAt.getTime() - a.updatedAt.getTime();
        if (sortMode === "date_desc") return b.createdAt.getTime() - a.createdAt.getTime();
        // default "profit_desc"
        return b.profit.toNumber() - a.profit.toNumber();
    });

    return (
        <div className="p-8 pb-32 max-w-7xl mx-auto space-y-8 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Financial Analytics</h1>
                    <p className="text-zinc-400 mt-2">Track real USD revenue, AWS/Fal COGS, and exact profit margins securely.</p>
                </div>

                {/* Filters & Search Form */}
                <form method="GET" className="flex items-end gap-4 bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl">
                    <div className="flex flex-col gap-1 w-64">
                        <label className="text-xs text-zinc-500 font-semibold uppercase">Search Users</label>
                        <input name="query" type="text" placeholder="Email or Name..." defaultValue={searchStr} className="bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-zinc-600 w-full placeholder:text-zinc-600" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500 font-semibold uppercase">Sort By</label>
                        <select name="sort" defaultValue={sortMode} className="bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-zinc-600">
                            <option value="profit_desc">Net Profit (Desc)</option>
                            <option value="activity_desc">Last Activity</option>
                            <option value="date_desc">Registration Date</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 hidden md:flex">
                        <label className="text-xs text-zinc-500 font-semibold uppercase">Start Date</label>
                        <input name="startDate" type="date" defaultValue={startDateStr} className="bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-zinc-600" />
                    </div>
                    <div className="flex flex-col gap-1 hidden md:flex">
                        <label className="text-xs text-zinc-500 font-semibold uppercase">End Date</label>
                        <input name="endDate" type="date" defaultValue={endDateStr} className="bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-zinc-600" />
                    </div>
                    <button type="submit" className="bg-white text-black px-6 py-2 font-semibold text-sm rounded-lg hover:bg-zinc-200 transition-colors">
                        Search & Filter
                    </button>
                </form>
            </div>

            {/* GLOBAL STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Gross Revenue (Lifetime)</h3>
                    <p className="text-4xl font-light text-white mt-4 tracking-tighter">${lifetimeGrossRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Total COGS (Range)</h3>
                    <p className="text-4xl font-light text-red-400 mt-4 tracking-tighter">${totalCogs.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Net Profit</h3>
                    <p className={`text-4xl font-light mt-4 tracking-tighter ${netProfit.toNumber() >= 0 ? "text-emerald-400" : "text-amber-500"}`}>
                        ${netProfit.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* USER LIST */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mt-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-800/50 border-b border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">User Account</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Total Revenue</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Total COGS (Range)</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Net Profit</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {userDict.map((user) => (
                                <tr key={user.id} className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 text-sm text-white font-medium">
                                        <div className="flex flex-col">
                                            <span>{user.email}</span>
                                            <span className="text-[10px] text-zinc-500 font-mono tracking-wider">
                                                {user.createdAt.toISOString().split("T")[0]} &bull; {user.id.split("-")[0]}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-white text-right font-mono">${user.total_spent_usd?.toFixed(2) || "0.00"}</td>
                                    <td className="px-6 py-4 text-sm text-red-400 text-right font-mono">-${user.cogs.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono font-medium text-emerald-400">
                                        ${user.profit.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        <Link href={`/${secretRoute}/analytics/users/${user.id}`} className="text-zinc-500 hover:text-white transition-colors underline decoration-zinc-700 underline-offset-4">
                                            View Detail
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {userDict.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">No users found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
