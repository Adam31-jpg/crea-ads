import { NextResponse } from "next/server";

/**
 * /auth/callback — Legacy Supabase OAuth callback route.
 * This route is no longer used since migrating to NextAuth v5.
 * NextAuth handles OAuth callbacks at /api/auth/callback/[provider].
 * Keeping this as a redirect stub to avoid 404s from any stale links.
 */
export async function GET(request: Request) {
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/dashboard`);
}
