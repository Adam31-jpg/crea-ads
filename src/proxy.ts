/**
 * src/proxy.ts — Pass-through proxy required by Next.js 16.
 * Auth is handled entirely by NextAuth middleware in /middleware.ts.
 */
import type { NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
    return request;
}
