import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from "@supabase/supabase-js";

// Mapping the exact variant IDs (or price amounts if variant ID is complex, but pack size is better)
// In production, matching the specific product or variant ID to the pack size is ideal.
// We map them roughly here for the Implementation. For real integration, you capture the actual LemonSqueezy Variant ID.
const SPARK_PACKS: Record<string, number> = {
    // These strings must exactly match the variant IDs sent in the webhook payload
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
            console.error("Missing LEMON_SQUEEZY_WEBHOOK_SECRET");
            return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 500 });
        }

        const hmac = crypto.createHmac('sha256', secret);
        const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
        const signatureBuffer = Buffer.from(signature, 'utf8');

        if (!crypto.timingSafeEqual(digest, signatureBuffer)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const eventName = payload.meta.event_name;

        // We only care about order_created events
        if (eventName === 'order_created') {
            const customData = payload.meta.custom_data;
            const userId = customData?.user_id;

            if (!userId) {
                console.error("No user_id found in custom_data");
                return NextResponse.json({ error: 'Missing user_id in payload' }, { status: 400 });
            }

            // In Lemon Squeezy, order items are usually returned nested. For simplicity,
            // we will extract the first item's variant ID.
            const variantId = payload.data.attributes.first_order_item?.variant_id?.toString() || 'variant-001'; // Fallback for testing
            const creditsToAdd = SPARK_PACKS[variantId] || 0;

            if (creditsToAdd === 0) {
                console.error(`Unknown variant ID: ${variantId}`);
                return NextResponse.json({ error: 'Unknown variant ID' }, { status: 400 });
            }

            // Need Service Role Key to bypass RLS for incrementing credits
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // Execute the secure RPC call for atomicity
            const { error: rpcError } = await supabaseAdmin.rpc('increment_credits', {
                p_user_id: userId,
                p_amount: creditsToAdd
            });

            if (rpcError) {
                console.error("RPC Error updating credits", rpcError);
                return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
            }

            console.log(`Successfully added ${creditsToAdd} Sparks to user ${userId}`);
        }

        return NextResponse.json({ received: true }, { status: 200 });
    } catch (err: any) {
        console.error("Webhook processing error", err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
