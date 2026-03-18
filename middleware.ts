import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * middleware.ts — Edge Runtime compatible.
 *
 * next-intl v4 is used in "without routing" mode — locale is resolved
 * server-side via cookie/Accept-Language in src/i18n/request.ts.
 * No next-intl middleware is required here.
 *
 * Auth protection is handled by authConfig.callbacks.authorized().
 * authConfig has zero Node.js-only imports, making it Edge-safe.
 */
export const { auth: middleware } = NextAuth(authConfig);
export default middleware;

export const config = {
    matcher: [
        // Skip Next.js internals, static files, auth routes, and public pages.
        // The dot in favicon.ico must be escaped for the Edge regex compiler.
        "/((?!api/auth|_next/static|_next/image|favicon\\.ico|login|signup).*)",
    ],
};
