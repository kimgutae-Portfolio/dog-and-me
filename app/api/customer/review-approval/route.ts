import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { notifyAdmins } from "../../../lib/adminPush";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !publishableKey || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { orderId?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
  if (!UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: "invalid_order" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const accessToken = authorization.slice(7);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id,user_id,status,customer_approved_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.user_id !== authData.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let approvedAt = order.customer_approved_at;
  if (order.status === "customer_review") {
    const { data, error } = await supabase.rpc("customer_approve_review", {
      p_order_id: orderId,
    });
    if (error) {
      const message = error.message.toLowerCase();
      const code = message.includes("open revision")
        ? "open_revision"
        : message.includes("payment")
          ? "payment_required"
          : message.includes("consent")
            ? "consent_required"
            : "approval_failed";
      return NextResponse.json({ error: code }, { status: 400 });
    }
    approvedAt = typeof data === "string" ? data : new Date().toISOString();
  } else if (
    !approvedAt ||
    !["quality_check", "delivered"].includes(order.status)
  ) {
    return NextResponse.json({ error: "approval_unavailable" }, { status: 409 });
  }

  let notificationResult: Awaited<ReturnType<typeof notifyAdmins>> | null = null;
  try {
    notificationResult = await notifyAdmins({
      orderId,
      type: "review_approved",
      eventKey: approvedAt,
    });
  } catch {
    // The customer's saved approval remains authoritative if push delivery is unavailable.
  }

  return NextResponse.json({
    approved: true,
    approvedAt,
    notificationQueued: Boolean(notificationResult?.notificationIds.length),
    notificationDelivered: (notificationResult?.notified ?? 0) > 0,
    notificationReason: notificationResult?.reason ?? null,
  });
}
