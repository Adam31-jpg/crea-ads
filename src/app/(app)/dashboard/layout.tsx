import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let session;
    try {
        session = await auth();
    } catch (e) {
        // During Vercel build time, auth() may fail — redirect gracefully
        console.warn('[dashboard/layout] auth() failed, likely build time:', e);
        redirect("/login");
    }

    if (!session?.user) {
        redirect("/login");
    }

    return (
        <div className="dashboard-shell flex bg-background">
            {/* Sidebar — elevated surface for 'application shell' feel */}
            <DashboardSidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <DashboardTopbar user={session.user} />
                <main className="flex-1 overflow-y-auto p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
