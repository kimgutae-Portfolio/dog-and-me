import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { hasCurrentConsent } from "../../../lib/consent";
import { DEFAULT_SITE_ORIGIN } from "../../../lib/site";
import { getStripeServerClient } from "../../../lib/stripe-server";
import type { MemoryOrder } from "../../../lib/supabase/types";

export const runtime = "nodejs";

type CheckoutRequest = {
  orderId?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: CheckoutRequest;
  try {
    payload = await request.json() as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
  if (!UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: "invalid_order" }, { status: 400 });
  }

  const accessToken = authorization.slice(7);
  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Resolve the order with the customer's authenticated client. The orders RLS
  // policy already limits this query to the owner, so a customer who can see
  // the order in Studio can use that same order to begin checkout.
  const { data: orderData, error: orderError } = await userClient
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error("Checkout order lookup failed", {
      code: orderError.code,
      message: orderError.message,
      orderId,
      userId: authData.user.id,
    });
    return NextResponse.json({ error: "order_lookup_failed" }, { status: 500 });
  }
  if (!orderData) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const order = orderData as MemoryOrder;
  if (order.payment_status === "paid") {
    return NextResponse.json({ paid: true });
  }
  if (order.payment_status !== "invoice_sent") {
    return NextResponse.json({ error: "payment_not_requested" }, { status: 409 });
  }
  if (order.status !== "concept_selected" || !order.selected_concept_slot) {
    return NextResponse.json({ error: "order_not_ready" }, { status: 409 });
  }
  if (!hasCurrentConsent(order)) {
    return NextResponse.json({ error: "consent_required" }, { status: 409 });
  }
  if (!Number.isSafeInteger(order.quoted_price) || order.quoted_price < 100 || order.quoted_price > 1_000_000) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }
  if (order.currency.toUpperCase() !== "JPY") {
    return NextResponse.json({ error: "unsupported_currency" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: activeSession, error: activeSessionError } = await admin
    .from("stripe_checkout_sessions")
    .select("*")
    .eq("order_id", order.id)
    .in("status", ["creating", "open"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeSessionError) {
    console.error("Checkout session lookup failed", {
      code: activeSessionError.code,
      message: activeSessionError.message,
      orderId: order.id,
    });
    return NextResponse.json({ error: "checkout_storage_unavailable" }, { status: 500 });
  }

  const stripe = getStripeServerClient();
  if (activeSession?.stripe_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(activeSession.stripe_session_id);
    if (existing.status === "open" && existing.url) {
      return NextResponse.json({ url: existing.url });
    }
    if (existing.status === "complete") {
      return NextResponse.json({ processing: true });
    }
    await admin
      .from("stripe_checkout_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", activeSession.id);
  } else if (activeSession) {
    const createdAt = new Date(activeSession.created_at).getTime();
    if (Date.now() - createdAt < 5 * 60 * 1000) {
      return NextResponse.json({ error: "checkout_is_being_prepared" }, { status: 409 });
    }
    await admin
      .from("stripe_checkout_sessions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", activeSession.id);
  }

  const { data: reservation, error: reservationError } = await admin
    .from("stripe_checkout_sessions")
    .insert({
      order_id: order.id,
      user_id: order.user_id,
      amount: order.quoted_price,
      currency: order.currency.toLowerCase(),
      status: "creating",
    })
    .select("*")
    .single();

  if (reservationError || !reservation) {
    const { data: concurrentSession, error: concurrentSessionError } = await admin
      .from("stripe_checkout_sessions")
      .select("stripe_session_id,status")
      .eq("order_id", order.id)
      .in("status", ["creating", "open"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (concurrentSessionError) {
      console.error("Concurrent checkout lookup failed", {
        code: concurrentSessionError.code,
        message: concurrentSessionError.message,
        orderId: order.id,
      });
      return NextResponse.json({ error: "checkout_storage_unavailable" }, { status: 500 });
    }
    if (concurrentSession?.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(concurrentSession.stripe_session_id);
      if (existing.status === "open" && existing.url) return NextResponse.json({ url: existing.url });
    }
    if (concurrentSession) {
      return NextResponse.json({ error: "checkout_is_being_prepared" }, { status: 409 });
    }
    console.error("Checkout session reservation failed", {
      code: reservationError?.code,
      message: reservationError?.message,
      orderId: order.id,
    });
    return NextResponse.json({ error: "checkout_storage_unavailable" }, { status: 500 });
  }

  const origin = (process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN).replace(/\/+$/, "");
  const metadata = {
    order_id: order.id,
    order_number: order.order_number,
    user_id: order.user_id,
    checkout_record_id: reservation.id,
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "ja",
      payment_method_types: ["card"],
      customer_email: authData.user.email ?? undefined,
      client_reference_id: order.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: order.quoted_price,
          product_data: {
            name: "WAN MEMORY メモリーフィルム",
            description: `${order.pet_name}ちゃんの思い出映像制作（${order.order_number}・税込）`,
          },
        },
      }],
      metadata,
      payment_intent_data: {
        description: `WAN MEMORY ${order.order_number}`,
        metadata,
        receipt_email: authData.user.email ?? undefined,
      },
      success_url: `${origin}/studio?order=${encodeURIComponent(order.id)}&payment=success&session_id={CHECKOUT_SESSION_ID}#payment`,
      cancel_url: `${origin}/studio?order=${encodeURIComponent(order.id)}&payment=cancelled#payment`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      submit_type: "pay",
    }, {
      idempotencyKey: `wm-checkout-${reservation.id}`,
    });

    if (!session.url) throw new Error("checkout_url_missing");
    const { error: saveError } = await admin
      .from("stripe_checkout_sessions")
      .update({
        stripe_session_id: session.id,
        status: "open",
        livemode: session.livemode,
        expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservation.id);
    if (saveError) throw saveError;

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout creation failed", error);
    await admin
      .from("stripe_checkout_sessions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", reservation.id);
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }
}
