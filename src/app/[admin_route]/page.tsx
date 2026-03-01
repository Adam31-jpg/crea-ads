import { redirect } from "next/navigation";

export default function AdminLandingPage() {
    // Hard redirect to the sandbox via the rewrites path
    const secretRoute = process.env.ADMIN_ROUTE_PATH || "/_fallback_admin_xyz";
    redirect(`${secretRoute}/sandbox`);
}
