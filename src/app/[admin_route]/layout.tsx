import { cookies } from "next/headers";
import { AdminLoginScreen } from "@/components/admin/AdminLoginScreen";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { notFound } from "next/navigation";

export default async function AdminLayout({ children, params }: { children: React.ReactNode, params: any }) {
    // Next.js versions handle params synchronously or asynchronously; Promise.resolve covers both.
    const resolvedParams = await Promise.resolve(params);
    const routeParam = resolvedParams?.admin_route;

    // Clean slashes, quotes, and whitespace from env for strict match
    const rawEnv = process.env.ADMIN_ROUTE_PATH || "admin-internal";
    const expectedRoute = rawEnv.replace(/['"]/g, '').replace(/^\//, '').replace(/\/$/, '').trim();

    console.log('[AdminLayout Security Check]', { routeParam, rawEnv, expectedRoute });

    if (routeParam?.trim() !== expectedRoute) {
        console.error(`SECURITY BLOCK: routeParam '${routeParam}' did not match expectedRoute '${expectedRoute}'`);
        notFound();
    }

    const cookieStore = await cookies();
    const adminAuth = cookieStore.get("admin_auth");

    if (adminAuth?.value !== process.env.ADMIN_PASSWORD) {
        return <AdminLoginScreen />;
    }

    const secretRoute = process.env.ADMIN_ROUTE_PATH || "/admin-internal";

    return (
        <div className="flex h-screen bg-black text-white selection:bg-zinc-800">
            <AdminSidebar secretRoute={secretRoute} />
            <main className="flex-1 h-screen overflow-auto bg-zinc-950">
                {children}
            </main>
        </div>
    );
}
