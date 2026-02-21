import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {} as any);

export async function POST(req: Request) {
    try {
        const { userId, planId } = await req.json();

        if (!userId || !planId) {
            return NextResponse.json({ error: 'Missing userId or planId' }, { status: 400 });
        }

        // Map planId to price and credit amount
        // In production, these should be Stripe Price IDs
        let unitAmount = 1500; // 15€
        let credits = "50";
        let productName = "Pack Starter (50 Crédits)";

        if (planId === "pro") {
            unitAmount = 4500; // 45€
            credits = "200";
            productName = "Pack Pro (200 Crédits)";
        } else if (planId === "business") {
            unitAmount = 9000; // 90€
            credits = "500";
            productName = "Pack Business (500 Crédits)";
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: productName,
                            description: `Achat de ${credits} jetons pour Lumina`,
                        },
                        unit_amount: unitAmount,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?canceled=true`,
            client_reference_id: userId,
            metadata: {
                credits: credits,
                planId: planId
            }
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error("Error creating stripe session:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
