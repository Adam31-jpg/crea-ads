// ─── SSE Client Registry ──────────────────────────────────────────────────────
// In-memory map of userId → Set of SSE stream controllers.
// Used to push real-time events (credit balance, job status) to connected clients.
//
// Architecture notes:
//  • Works correctly for single-instance deployments (local dev + single EC2/ECS).
//  • For multi-instance deployments (auto-scaling), replace with Redis pub/sub
//    (e.g. ioredis + a shared channel) so all instances can broadcast.
//  • Controllers are removed automatically when the client disconnects (AbortSignal).

type Controller = ReadableStreamDefaultController<Uint8Array>;

const sseClients = new Map<string, Set<Controller>>();

/**
 * Register a new SSE controller for a user.
 * Returns an unsubscribe function that cleans up on disconnect.
 */
export function subscribe(userId: string, controller: Controller): () => void {
    if (!sseClients.has(userId)) {
        sseClients.set(userId, new Set());
    }
    sseClients.get(userId)!.add(controller);

    return () => {
        const set = sseClients.get(userId);
        if (set) {
            set.delete(controller);
            if (set.size === 0) sseClients.delete(userId);
        }
    };
}

/**
 * Broadcast a typed event payload to all SSE connections for a given user.
 *
 * Payload is serialised as a Server-Sent Events `data:` line.
 * The client receives: `data: {"type":"credits_update","credits":42}\n\n`
 */
export function broadcast(userId: string, payload: Record<string, unknown>): void {
    const controllers = sseClients.get(userId);
    if (!controllers || controllers.size === 0) return;

    const message = `data: ${JSON.stringify(payload)}\n\n`;
    const encoded = new TextEncoder().encode(message);

    for (const ctrl of controllers) {
        try {
            ctrl.enqueue(encoded);
        } catch {
            // Controller closed — will be cleaned up via disconnect handler
        }
    }
}
