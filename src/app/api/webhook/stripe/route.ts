import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { broadcast } from '@/lib/sse';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {} as any);
    const payload = await req.text();
    const signature = req.headers.get('Stripe-Signature');

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            payload,
            signature as string,
            process.env.STRIPE_WEBHOOK_SECRET as string
        );
    } catch (err: any) {
        console.error('⚠️  Stripe webhook signature verification failed.', err.message);
        return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const purchasedCredits = parseInt(session.metadata?.credits || '0', 10);

        if (!userId) {
            console.error('[Stripe] No client_reference_id found. Cannot credit user.');
            return NextResponse.json({ error: 'missingClientRef' }, { status: 400 });
        }

        if (purchasedCredits > 0) {
            console.log(`[Stripe] Fulfilling purchase: +${purchasedCredits} Sparks → user ${userId}`);
            const updated = await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: purchasedCredits } },
                select: { credits: true },
            });
            console.log(`[Stripe] User ${userId} now has ${updated.credits} credits.`);
            broadcast(userId, { type: 'credits_update', credits: updated.credits });
        }
    }

    return NextResponse.json({ received: true });
}
