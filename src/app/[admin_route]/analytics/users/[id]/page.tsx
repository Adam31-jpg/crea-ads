import React from "react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Decimal } from "@prisma/client/runtime/library";
import { Sparkles, TrendingUp, CreditCard, ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { SparksAdjustmentForm } from "@/components/admin/SparksAdjustmentForm";
import { BugTable } from "@/components/admin/BugTable";

export default async function UserDetailAnalytics({
    params,
    searchParams
}: {
    params: any;
    searchParams: any;
}) {
    const p = await Promise.resolve(params);
    const sp = await Promise.resolve(searchParams);

    const secretRoute = p.admin_route;
    const userId = p.id;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            bugReports: { orderBy: { createdAt: "desc" } }
        }
    });

    if (!user) return notFound();

    // Date Filters
    const ltvMode = sp?.range === "ltv";
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const defaultEnd = now.toISOString().split("T")[0];

    const startDateStr = ltvMode ? user.createdAt.toISOString().split("T")[0] : (sp?.startDate || defaultStart);
    const endDateStr = sp?.endDate || defaultEnd;

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    // Queries
    const batchesInRange = await prisma.batch.findMany({
        where: { userId, createdAt: { gte: startDate, lte: endDate } },
        include: { _count: { select: { jobs: true } } },
        orderBy: { createdAt: "desc" }
    });

    const totalCogs = batchesInRange.reduce(
        (acc, batch) => acc.add(batch.cost_usd || new Decimal(0)),
        new Decimal(0)
    );

    // Mocks / Derived Stats
    const totalSparksConsumed = batchesInRange.reduce((sum, batch) => sum + batch._count.jobs, 0);
    const totalRevenue = user.total_spent_usd || new Decimal(0);
    const netProfit = totalRevenue.sub(totalCogs);

    const userBugs = user.bugReports || [];

    // Mock Stripe Transactions (since no DB ledger exists yet)
    const mockStripeTxs = ltvMode && totalRevenue.toNumber() > 0 ? [
        { id: "pi_3MtwBwLkdIwHu7ix28a3tq1M", amount: totalRevenue.toNumber(), date: user.createdAt.toISOString().split("T")[0], status: "succeeded" }
    ] : [];

    return (
        <div className="p-8 pb-32 max-w-5xl mx-auto space-y-8 font-sans">
            <div className="flex items-center gap-4 mb-8">
                <Link href={`/${secretRoute}/analytics`} className="p-2 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                            {user.email}
                            <span className="px-2 py-0.5 bg-zinc-800 text-xs text-zinc-400 rounded-md font-mono">{user.id}</span>
                        </h1>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                <form method="GET" className="flex items-end gap-3 flex-1">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500 font-semibold uppercase">Start Date</label>
                        <input name="startDate" type="date" defaultValue={startDateStr} className="bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-zinc-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500 font-semibold uppercase">End Date</label>
                        <input name="endDate" type="date" defaultValue={endDateStr} className="bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-zinc-500" />
                    </div>
                    <button type="submit" className="bg-white text-black px-4 py-2 font-semibold text-sm rounded-lg hover:bg-zinc-200 transition-colors">
                        Apply Filter
                    </button>
                    <Link href={`/${secretRoute}/analytics/users/${user.id}?range=ltv`} className="ml-2 border border-zinc-700 text-zinc-300 px-4 py-2 text-sm rounded-lg hover:bg-zinc-800 transition-colors">
                        Since Registration (LTV)
                    </Link>
                </form>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
                    <TrendingUp className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-zinc-800/50" />
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Gross Revenue</h3>
                    <p className="text-4xl font-light text-white mt-4 relative z-10 tracking-tighter">${totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Cost of Goods Sold</h3>
                    <p className="text-4xl font-light text-red-400 mt-4 tracking-tighter">-${totalCogs.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Net Profit</h3>
                    <p className={`text-4xl font-light mt-4 tracking-tighter ${netProfit.toNumber() >= 0 ? "text-emerald-400" : "text-amber-500"}`}>
                        ${netProfit.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Main Content & Sidebar Layout */}
            <div className="flex w-full gap-6">

                {/* Main Content Area */}
                <div className="w-full lg:col-span-2 space-y-6">
                    {/* Visual Chart Placeholder */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-6">Sparks Consumption vs. USD Spent</h3>
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-sm mb-2 text-zinc-300">
                                    <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> Sparks Consumed (Estimated)</span>
                                    <span className="font-mono">{totalSparksConsumed} uses</span>
                                </div>
                                <div className="w-full bg-zinc-950 rounded-full h-3 border border-zinc-800">
                                    <div className="bg-amber-400 h-2.5 rounded-full" style={{ width: `${Math.min((totalSparksConsumed / 100) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2 text-zinc-300">
                                    <span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400" /> USD Revenue Allocated</span>
                                    <span className="font-mono">${totalRevenue.toFixed(2)}</span>
                                </div>
                                <div className="w-full bg-zinc-950 rounded-full h-3 border border-zinc-800">
                                    <div className="bg-emerald-400 h-2.5 rounded-full" style={{ width: `${Math.min((totalRevenue.toNumber() / 50) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Batch List Table */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-800">
                            <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Production History (Batches)</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left whitespace-nowrap">
                                <thead className="bg-zinc-800/50 border-b border-zinc-800">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date/Time</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Asset Count</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">COGS</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800">
                                    {batchesInRange.map(batch => (
                                        <tr key={batch.id} className="hover:bg-zinc-800/20 transition-colors cursor-pointer" title="Click to view full batch details">
                                            <td className="px-6 py-4">
                                                <Link href={`/${secretRoute}/analytics/users/${user.id}/batches/${batch.id}`} className="block text-sm text-zinc-300 font-mono underline decoration-zinc-700 underline-offset-4 hover:text-white">
                                                    {batch.createdAt.toLocaleString()}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-zinc-400 text-right">{batch._count.jobs} assets</td>
                                            <td className="px-6 py-4 text-sm text-red-400 text-right font-mono">-${batch.cost_usd.toFixed(4)}</td>
                                            <td className="px-6 py-4 text-sm text-right">
                                                <span className={`px-2 py-1 text-xs rounded-full ${batch.status === "done" ? "bg-emerald-500/10 text-emerald-400" : batch.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"}`}>
                                                    {batch.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {batchesInRange.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">No production batches recorded in this period.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Support Tickets & Bug Tracking */}
                    <BugTable bugs={userBugs} secretRoute={secretRoute} />
                </div>
            </div>
            {/* Sidebar Configuration */}
            <div className="lg:col-span-1 space-y-6">
                {/* Manual Spark Credit - God Mode */}
                <SparksAdjustmentForm
                    userName={user.email}
                    userId={user.id}
                    currentSparks={user.credits}
                    secretRoute={secretRoute}
                />
            </div>
            {/* List of Stripe Transactions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-zinc-800">
                    <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Stripe Transactions Ledger</h3>
                    <p className="text-xs text-zinc-500 mt-1">Pending live integration. Displaying mock/cached states where Revenue {">"} $0.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-zinc-800/50 border-b border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Transaction ID</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Amount (USD)</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {mockStripeTxs.map(tx => (
                                <tr key={tx.id} className="hover:bg-zinc-800/20">
                                    <td className="px-6 py-4 text-sm text-zinc-300 font-mono">{tx.id}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-400">{tx.date}</td>
                                    <td className="px-6 py-4 text-sm text-white text-right font-mono">${tx.amount.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-sm text-right"><span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">{tx.status}</span></td>
                                </tr>
                            ))}
                            {mockStripeTxs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">No transactions recorded in this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
