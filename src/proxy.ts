/**
 * src/proxy.ts — Auth proxy for Next.js 16 (replaces middleware.ts).
 * Uses NextAuth v5 higher-order function pattern for Vercel Edge Runtime.
 */
import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth(() => {
    // auth() injects req.auth with the session.
    // If the authorized() callback in authConfig returns false,
    // NextAuth automatically redirects to the signIn page.
    // If we reach here, the request is authorized.
    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!api/auth|_next/static|_next/image|favicon\\.ico|login|signup).*)",
    ],
};
