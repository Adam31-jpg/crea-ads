import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {} as any);

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Retrieve the stripe_customer_id from the profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        if (!profile || !profile.stripe_customer_id) {
            return NextResponse.json(
                { error: 'Aucun identifiant de facturation trouvé. Vous n\'avez peut-être pas encore effectué d\'achat.' },
                { status: 400 }
            );
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: profile.stripe_customer_id,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error("Error creating billing portal session:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
