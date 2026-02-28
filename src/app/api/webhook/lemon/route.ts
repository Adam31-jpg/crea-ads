import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { broadcast } from '@/lib/sse';

const SPARK_PACKS: Record<string, number> = {
    'variant-001': 25,
    'variant-002': 100,
    'variant-003': 250,
};

export async function POST(req: Request) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get('x-signature');

        if (!signature) {
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
        }

        const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
        if (!secret) {
            console.error('[Lemon] Missing LEMON_SQUEEZY_WEBHOOK_SECRET');
            return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 500 });
        }

        const hmac = crypto.createHmac('sha256', secret);
        const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
        const sigBuffer = Buffer.from(signature, 'utf8');

        if (!crypto.timingSafeEqual(digest, sigBuffer)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const eventName = payload.meta.event_name;

        if (eventName === 'order_created') {
            const userId = payload.meta.custom_data?.user_id as string | undefined;
            const variantId = String(payload.data.attributes.first_order_item?.variant_id || 'variant-001');
            const creditsToAdd = SPARK_PACKS[variantId] || 0;

            if (!userId) {
                console.error('[Lemon] No user_id in custom_data');
                return NextResponse.json({ error: 'Missing user_id in payload' }, { status: 400 });
            }

            if (creditsToAdd === 0) {
                console.error(`[Lemon] Unknown variant ID: ${variantId}`);
                return NextResponse.json({ error: 'Unknown variant ID' }, { status: 400 });
            }

            const updated = await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: creditsToAdd } },
                select: { credits: true },
            });

            console.log(`[Lemon] Added ${creditsToAdd} Sparks to user ${userId}. New balance: ${updated.credits}`);
            broadcast(userId, { type: 'credits_update', credits: updated.credits });
        }

        return NextResponse.json({ received: true }, { status: 200 });
    } catch (err: any) {
        console.error('[Lemon] Webhook processing error', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
