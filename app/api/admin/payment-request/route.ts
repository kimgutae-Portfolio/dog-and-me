import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendPaymentRequestNotification } from "../../../lib/email/messageNotification";
import { DEFAULT_SITE_ORIGIN } from "../../../lib/site";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { orderId?: unknown };
  try {
    payload = await request.json() as { orderId?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
  if (!UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: "invalid_order" }, { status: 400 });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(authorization.slice(7));
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await userClient.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: order } = await userClient
    .from("orders")
    .select("id,user_id,order_number,pet_name,quoted_price,payment_status,updated_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.payment_status !== "invoice_sent") {
    return NextResponse.json({ error: "payment_not_requested" }, { status: 409 });
  }

  const { data: customer } = await userClient.from("profiles").select("email").eq("id", order.user_id).maybeSingle();
  if (!customer?.email) {
    return NextResponse.json({ sent: false, reason: "recipient_not_found" });
  }

  const origin = (process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN).replace(/\/+$/, "");
  const studioUrl = `${origin}/studio?order=${encodeURIComponent(order.id)}#payment`;
  const notification = await sendPaymentRequestNotification({
    to: customer.email,
    petName: order.pet_name,
    amount: order.quoted_price,
    studioUrl,
    idempotencyKey: `payment-request-${order.id}-${order.updated_at}`,
  });

  return NextResponse.json({
    sent: notification.sent,
    reason: notification.sent ? null : notification.reason,
  });
}
