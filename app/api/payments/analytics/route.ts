import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getStripeMode } from "../../../lib/stripe-mode";
import { verifiedPurchase } from "../../../lib/purchase-analytics";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

// Read-only. A success URL cannot prove payment. Only a live Checkout record
// already marked paid by the signed, amount-verified webhook is eligible.
export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !serviceKey) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  try {
    if (getStripeMode() !== "live") return NextResponse.json({ purchase: null }, { headers: noStore });
  } catch { return NextResponse.json({ purchase: null }, { headers: noStore }); }
  const payload: unknown = await request.json().catch(() => null);
  const orderId = payload && typeof payload === "object" && "orderId" in payload ? payload.orderId : null;
  if (typeof orderId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId))
    return NextResponse.json({ error: "invalid_order" }, { status: 400, headers: noStore });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
  if (authError || !auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const { data: order, error: orderError } = await client.from("orders").select("id,user_id,payment_status,quoted_price,currency").eq("id", orderId).eq("user_id", auth.user.id).maybeSingle();
  if (orderError) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  if (order.payment_status !== "paid" || order.quoted_price <= 0 || order.currency?.toUpperCase() !== "JPY") return NextResponse.json({ purchase: null }, { headers: noStore });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: checkout, error } = await admin.from("stripe_checkout_sessions")
    .select("stripe_session_id,amount,currency,paid_at,status,livemode")
    .eq("order_id", orderId).eq("user_id", auth.user.id).eq("status", "paid").eq("livemode", true)
    .order("paid_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503, headers: noStore });
  return NextResponse.json({ purchase: verifiedPurchase(order, checkout) }, { headers: noStore });
}
