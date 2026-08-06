import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type SubscriptionPayload = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  userAgent?: unknown;
};

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

async function authenticatedAdmin(request: NextRequest) {
  const config = getConfig();
  const authorization = request.headers.get("authorization");
  if (!config || !authorization?.startsWith("Bearer ")) return null;
  const accessToken = authorization.slice(7);
  const supabase = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  return profile?.role === "admin" ? { supabase, userId: data.user.id } : null;
}

export async function POST(request: NextRequest) {
  const session = await authenticatedAdmin(request);
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let payload: SubscriptionPayload;
  try {
    payload = (await request.json()) as SubscriptionPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const endpoint = typeof payload.endpoint === "string" ? payload.endpoint.trim() : "";
  const p256dh = typeof payload.keys?.p256dh === "string" ? payload.keys.p256dh.trim() : "";
  const auth = typeof payload.keys?.auth === "string" ? payload.keys.auth.trim() : "";
  const userAgent = typeof payload.userAgent === "string" ? payload.userAgent.slice(0, 500) : null;
  if (!endpoint.startsWith("https://") || endpoint.length > 2048 || !p256dh || !auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const { error } = await session.supabase.from("admin_push_subscriptions").upsert(
    {
      admin_user_id: session.userId,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: "subscription_save_failed" }, { status: 500 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const session = await authenticatedAdmin(request);
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let payload: { endpoint?: unknown } = {};
  try {
    payload = (await request.json()) as { endpoint?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const endpoint = typeof payload.endpoint === "string" ? payload.endpoint.trim() : "";
  if (!endpoint) return NextResponse.json({ error: "invalid_endpoint" }, { status: 400 });
  const { error } = await session.supabase
    .from("admin_push_subscriptions")
    .delete()
    .eq("admin_user_id", session.userId)
    .eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: "subscription_delete_failed" }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
