import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeServerClient } from "../../../lib/stripe-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!signature || !webhookSecret || !supabaseUrl || !serviceRoleKey || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripeServerClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
        const { error } = await admin.rpc("process_stripe_checkout_completed", {
          p_event_id: event.id,
          p_event_type: event.type,
          p_stripe_session_id: session.id,
          p_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
          p_amount_total: session.amount_total ?? 0,
          p_currency: session.currency ?? "",
          p_livemode: event.livemode,
        });
        if (error) throw error;
      }
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { error } = await admin.rpc("process_stripe_checkout_closed", {
        p_event_id: event.id,
        p_event_type: event.type,
        p_stripe_session_id: session.id,
        p_status: event.type === "checkout.session.expired" ? "expired" : "failed",
      });
      if (error) throw error;
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
      if (paymentIntentId) {
        const { error } = await admin.rpc("process_stripe_refund", {
          p_event_id: event.id,
          p_event_type: event.type,
          p_payment_intent_id: paymentIntentId,
          p_amount_refunded: charge.amount_refunded,
          p_full_refund: charge.refunded,
        });
        if (error) throw error;
      }
    }
  } catch (error) {
    console.error("Stripe webhook processing failed", event.id, error);
    return NextResponse.json({ error: "webhook_processing_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

