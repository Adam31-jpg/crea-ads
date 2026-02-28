import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscribe, broadcast } from "@/lib/sse";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/events
 *
 * Server-Sent Events endpoint for real-time push updates.
 * Streams the following event types to the connected client:
 *
 *   { type: "credits_update", credits: number }
 *   { type: "job_update",     jobId: string, status: string, result_url?: string }
 *   { type: "heartbeat",      ts: number }  — every 30s to keep the connection alive
 *
 * Events are pushed by API routes that mutate credits or job status via broadcast()
 * from src/lib/sse.ts. The heartbeat prevents Nginx / CloudFront from closing idle connections.
 */
export async function GET(req: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Send the current credit balance as the first event so the UI is
    // immediately in sync without waiting for a mutation.
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
        start(ctrl) {
            // ── Initial credit sync ─────────────────────────────────────────────
            if (user) {
                ctrl.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({ type: "credits_update", credits: user.credits })}\n\n`
                    )
                );
            }

            // ── Register controller so broadcast() can push to this stream ───────
            const unsubscribe = subscribe(userId, ctrl);

            // ── 30s heartbeat — keeps the connection alive ────────────────────────
            const heartbeatInterval = setInterval(() => {
                try {
                    ctrl.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({ type: "heartbeat", ts: Date.now() })}\n\n`
                        )
                    );
                } catch {
                    clearInterval(heartbeatInterval);
                    unsubscribe();
                }
            }, 30_000);

            // ── Cleanup on client disconnect ──────────────────────────────────────
            req.signal.addEventListener("abort", () => {
                clearInterval(heartbeatInterval);
                unsubscribe();
                try { ctrl.close(); } catch { /* already closed */ }
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no", // Disable Nginx buffering
        },
    });
}

// Re-export broadcast so other API routes can push events without importing sse.ts
export { broadcast };
