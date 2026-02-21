import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh the auth session
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Protect /dashboard routes — redirect to /login if not authenticated
    const { pathname, searchParams } = request.nextUrl;

    if (pathname.startsWith("/dashboard")) {
        if (!user) {
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            url.searchParams.set("next", pathname);
            return NextResponse.redirect(url);
        }
    }

    // Redirect authenticated users away from auth pages
    if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
        if (user) {
            const url = request.nextUrl.clone();
            const nextPath = searchParams.get("next") || "/dashboard";
            url.pathname = nextPath;
            return NextResponse.redirect(url);
        }
    }

    // Protect API routes (except webhooks)
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/webhook")) {
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        // Match all routes except static files and API routes
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
