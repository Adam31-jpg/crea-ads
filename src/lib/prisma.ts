import { PrismaClient } from '@prisma/client';

// ─── Singleton Prisma Client ───────────────────────────────────────────────────
// Prevents connection pool exhaustion on the RDS Free Tier during Next.js dev HMR.
// In production (NODE_ENV=production) a fresh instance is created and reused for
// the process lifetime. In development the instance is cached on `global` so that
// Hot Module Replacement does not spawn a new pool on every file save.
//
// RDS Free Tier (db.t3.micro) supports ~15 max_connections.
// connection_limit=3 keeps the pool conservative so concurrent API routes,
// Lambda webhooks, and SSE heartbeats don't exhaust the server's connection limit.
// socket_timeout=60 prevents P1001 errors when Fal.ai generation holds a connection
// open while waiting for AWS Lambda to complete a long render.

function buildDatabaseUrl(): string {
    const base = process.env.DATABASE_URL ?? '';
    if (!base) return base;
    try {
        const url = new URL(base);
        // Only add params if not already set — lets .env override take precedence.
        if (!url.searchParams.has('connection_limit')) {
            url.searchParams.set('connection_limit', '3');
        }
        if (!url.searchParams.has('connect_timeout')) {
            url.searchParams.set('connect_timeout', '10');
        }
        if (!url.searchParams.has('socket_timeout')) {
            url.searchParams.set('socket_timeout', '60');
        }
        return url.toString();
    } catch {
        return base;
    }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
    // During Vercel build, DATABASE_URL may not be available.
    // Return a Proxy that warns at module init but throws only when actually queried.
    if (!process.env.DATABASE_URL) {
        console.warn('[prisma] DATABASE_URL not set — returning dummy client (build time only)');
        return new Proxy({} as PrismaClient, {
            get(_target, prop) {
                // Allow lifecycle methods so Prisma internals don't blow up on import
                if (prop === '$connect' || prop === '$disconnect' || prop === '$on' || prop === 'then') {
                    return () => Promise.resolve();
                }
                // Any model access (user, job, storeAnalysis, etc.) returns a proxy that throws
                return new Proxy({}, {
                    get() {
                        throw new Error(
                            `[prisma] Cannot query database — DATABASE_URL is not configured. ` +
                            `This is expected during Vercel build. Set DATABASE_URL in environment variables.`
                        );
                    },
                });
            },
        });
    }

    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        datasources: { db: { url: buildDatabaseUrl() } },
    });
}

export const prisma: PrismaClient =
    globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
