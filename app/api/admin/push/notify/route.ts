import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { notifyAdmins, type AdminPushEventType } from "../../../../lib/adminPush";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUSTOMER_EVENTS = new Set<AdminPushEventType>([
  "order_submitted",
  "customer_message",
  "customer_revision",
  "stills_change_requested",
  "stills_approved",
  "review_approved",
]);

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !publishableKey || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { orderId?: unknown; type?: unknown; eventKey?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
  const type = typeof payload.type === "string" ? payload.type.trim() as AdminPushEventType : null;
  const eventKey = typeof payload.eventKey === "string" ? payload.eventKey.slice(0, 120) : undefined;
  if (!UUID_PATTERN.test(orderId) || !type || !CUSTOMER_EVENTS.has(type)) {
    return NextResponse.json({ error: "invalid_notification" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const accessToken = authorization.slice(7);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: order } = await supabase.from("orders").select("id,user_id").eq("id", orderId).maybeSingle();
  if (!order || order.user_id !== authData.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await notifyAdmins({ orderId, type, eventKey });
  return NextResponse.json({ queued: true, ...result });
}
