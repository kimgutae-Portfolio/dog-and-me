import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendCustomerMessageNotification } from "../../../lib/email/messageNotification";
import { DEFAULT_SITE_ORIGIN } from "../../../lib/site";

export const runtime = "nodejs";

type MessageRequest = {
  orderId?: unknown;
  body?: unknown;
};

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: MessageRequest;
  try {
    payload = await request.json() as MessageRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json({ error: "invalid_order" }, { status: 400 });
  }
  if (!body || body.length > 3000) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(authorization.slice(7));
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error: messageError } = await userClient.rpc("admin_send_message", {
    p_order_id: orderId,
    p_body: body,
  });
  if (messageError) {
    const forbidden = messageError.message.includes("admin required");
    return NextResponse.json({ error: forbidden ? "forbidden" : "message_failed" }, { status: forbidden ? 403 : 400 });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: order }, { data: latestMessage }] = await Promise.all([
    serviceClient.from("orders").select("user_id").eq("id", orderId).maybeSingle(),
    serviceClient
      .from("messages")
      .select("id")
      .eq("order_id", orderId)
      .eq("sender_id", authData.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!order?.user_id) {
    return NextResponse.json({ saved: true, notificationSent: false, notificationReason: "recipient_not_found" });
  }

  const { data: customer } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("id", order.user_id)
    .maybeSingle();
  if (!customer?.email) {
    return NextResponse.json({ saved: true, notificationSent: false, notificationReason: "recipient_not_found" });
  }

  const siteOrigin = (process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN).replace(/\/+$/, "");
  const studioUrl = `${siteOrigin}/studio?order=${encodeURIComponent(orderId)}#messages`;
  const notification = await sendCustomerMessageNotification({
    to: customer.email,
    studioUrl,
    idempotencyKey: `admin-message-${latestMessage?.id ?? `${orderId}-${Date.now()}`}`,
  });

  return NextResponse.json({
    saved: true,
    notificationSent: notification.sent,
    notificationReason: notification.sent ? null : notification.reason,
  });
}
