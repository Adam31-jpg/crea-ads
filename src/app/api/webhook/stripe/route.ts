import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {} as any);

// Required for Stripe Webhooks to parse the raw body properly
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const payload = await req.text();
    const signature = req.headers.get('Stripe-Signature');

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            payload,
            signature as string,
            process.env.STRIPE_WEBHOOK_SECRET as string
        );
    } catch (err: any) {
        console.error(`⚠️  Webhook signature verification failed.`, err.message);
        return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.client_reference_id;
        if (!userId) {
            console.error("No client_reference_id found. Cannot credit user.");
            return NextResponse.json({ error: "Missing client_reference_id" }, { status: 400 });
        }

        // Determine how many credits were purchased
        const purchasedCreditsStr = session.metadata?.credits || '0';
        const purchasedCredits = parseInt(purchasedCreditsStr, 10);

        if (purchasedCredits > 0) {
            // Use Supabase Admin client to bypass RLS and update the profile securely
            const supabase = createAdminClient();

            console.log(`Fulfilling purchase... Adding ${purchasedCredits} credits to user ${userId}`);

            const { data: profile } = await supabase
                .from('profiles')
                .select('credits')
                .eq('id', userId)
                .single();

            const currentCredits = profile?.credits || 0;
            const newCredits = currentCredits + purchasedCredits;

            const { error } = await supabase
                .from('profiles')
                .update({ credits: newCredits })
                .eq('id', userId);

            if (error) {
                console.error("Error updating credits in Supabase:", error);
                return NextResponse.json({ error: "DB Update Failed" }, { status: 500 });
            }
            console.log("Successfully funded user.");
        }
    }

    return NextResponse.json({ received: true });
}
