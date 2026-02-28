export { auth as default } from "@/lib/auth";

export const config = {
    matcher: [
        // Protect all dashboard pages
        "/dashboard/:path*",
        // Protect all render / strategy / batch / job APIs
        "/api/render/:path*",
        "/api/strategy/:path*",
        "/api/batch/:path*",
        "/api/job/:path*",
        "/api/events",
        // Exclude auth routes so login / register stay public
        "/((?!api/auth|login|signup|_next/static|_next/image|favicon.ico).*)",
    ],
};
