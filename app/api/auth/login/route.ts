import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendLoginNotification } from "../../../lib/email/messageNotification";

export const runtime = "nodejs";

/**
 * Password sign-in with account lockout.
 *
 * The ideal enforcement point is Supabase's Password Verification Hook, which
 * the auth service calls on every password check and which therefore cannot be
 * bypassed — but that hook requires a Team/Enterprise plan. So the counter runs
 * here instead.
 *
 * ⚠️ Known limit: a client that calls the Supabase Auth REST API directly with
 * the publishable key never reaches this route and so is not locked out. That
 * path is covered by Supabase's own per-IP rate limiting. Stated plainly in
 * docs/SECURITY.md — do not describe this as unbypassable.
 *
 * The service-role client below is used ONLY for the three lockout RPCs, which
 * are granted to service_role alone. If `anon` could call login_record_failure,
 * anyone could lock any known address out with ten requests.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  let payload: { email?: unknown; password?: unknown };
  try {
    payload = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
  }

  // Without the service-role key the lockout cannot run; sign-in still works so
  // a misconfiguration degrades to "no lockout", never to "nobody can log in".
  const admin = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  if (admin) {
    const { data: status } = await admin.rpc("login_lock_status", { p_email: email });
    if ((status as { locked?: boolean } | null)?.locked) {
      return NextResponse.json({ error: "account_locked" }, { status: 423 });
    }
  }

  const anon = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    let locked = false;
    if (admin) {
      const { data: result } = await admin.rpc("login_record_failure", { p_email: email });
      locked = Boolean((result as { locked?: boolean } | null)?.locked);
    }
    return NextResponse.json(
      { error: locked ? "account_locked" : "invalid_credentials" },
      { status: locked ? 423 : 401 },
    );
  }

  if (admin) await admin.rpc("login_record_success", { p_email: email });

  // Notify the account owner. Never blocks the sign-in.
  const signedInAt = new Date();
  void sendLoginNotification({
    to: data.user?.email ?? email,
    signedInAt,
    idempotencyKey: `login-${data.user?.id ?? email}-${signedInAt.toISOString().slice(0, 13)}`,
  }).catch(() => {});

  // Handed to the browser, which adopts it via supabase.auth.setSession().
  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
