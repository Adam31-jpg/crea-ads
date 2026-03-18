/**
 * auth.config.ts — Edge-safe auth configuration.
 *
 * This file MUST NOT import Prisma, bcryptjs, or any Node.js-only module.
 * It is imported by middleware.ts which runs on the Edge Runtime.
 *
 * The full auth configuration (with PrismaAdapter, bcrypt, etc.) lives in
 * src/lib/auth.ts and is only used in server-side Node.js contexts.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
    // ─── Pages ─────────────────────────────────────────────────────────────────
    pages: {
        signIn: "/login",
        signOut: "/",
        error: "/login",
    },

    // ─── Callbacks ─────────────────────────────────────────────────────────────
    callbacks: {
        /**
         * authorized() runs on every request matching the middleware matcher.
         * Return true  → request proceeds.
         * Return false → user is redirected to signIn page.
         * Return a Response → custom redirect.
         *
         * We delegate the actual JWT verification to NextAuth internally;
         * we just check whether a session token exists here.
         */
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
            const isOnProtectedApi =
                nextUrl.pathname.startsWith("/api/render") ||
                nextUrl.pathname.startsWith("/api/strategy") ||
                nextUrl.pathname.startsWith("/api/batch") ||
                nextUrl.pathname.startsWith("/api/job") ||
                nextUrl.pathname.startsWith("/api/spy") ||
                nextUrl.pathname === "/api/events";

            if (isOnDashboard || isOnProtectedApi) {
                if (isLoggedIn) return true;
                return false; // redirect to /login
            }

            return true;
        },
    },

    providers: [], // Providers are configured in auth.ts (Node.js only)
};
