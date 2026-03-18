/**
 * middleware.ts — Edge Runtime compatible.
 *
 * Uses NextAuth initialised with the lean authConfig (no Prisma, no bcrypt).
 * Route protection logic lives in authConfig.callbacks.authorized().
 *
 * See: https://authjs.dev/guides/edge-compatibility
 */
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);
export default middleware;

export const config = {
    matcher: [
        /*
         * Match all routes EXCEPT:
         *  - _next/static (static files)
         *  - _next/image (image optimisation)
         *  - favicon.ico
         *  - api/auth/* (NextAuth internal endpoints — must stay public)
         *  - login / signup pages
         *  - Public marketing pages (root "/")
         */
        "/((?!api/auth|login|signup|_next/static|_next/image|favicon.ico).*)",
    ],
};

