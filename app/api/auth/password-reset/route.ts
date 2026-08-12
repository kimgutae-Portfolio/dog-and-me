import { createClient } from "@supabase/supabase-js";
import { sendPasswordResetNotification } from "../../../lib/email/messageNotification";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!emailPattern.test(email) || email.length > 254) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const configuredOrigin = process.env.SITE_ORIGIN?.trim();
  const origin = configuredOrigin || new URL(request.url).origin;
  const redirectTo = `${origin.replace(/\/$/, "")}/auth?mode=update-password&next=${encodeURIComponent("/studio")}`;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: limitError } = await admin.rpc(
    "password_reset_request_allowed",
    { p_email: email },
  );
  if (limitError) {
    return Response.json({ error: "reset_unavailable" }, { status: 503 });
  }
  // Unknown addresses and repeated requests receive the same successful
  // response. This prevents account discovery and repeated-email harassment.
  if (allowed !== true) return Response.json({ ok: true });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  // Do not reveal whether an address has an account. Unknown addresses receive
  // the same response but no email.
  if (error || !data.properties?.action_link) {
    return Response.json({ ok: true });
  }

  const sent = await sendPasswordResetNotification({
    to: email,
    recoveryUrl: data.properties.action_link,
    idempotencyKey: `password-reset-${data.user.id}-${crypto.randomUUID()}`,
  });
  if (!sent.sent) {
    return Response.json({ error: "email_unavailable" }, { status: 503 });
  }

  return Response.json({ ok: true });
}
