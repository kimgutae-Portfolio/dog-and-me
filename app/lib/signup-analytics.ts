"use client";

import { trackEvent, trackOnce } from "./analytics";

const PENDING_SIGNUP = "wm-pending-signup-analytics";
type SignupMethod = "Google" | "email";

export function rememberSignupAttempt(method: SignupMethod) {
  try { localStorage.setItem(PENDING_SIGNUP, JSON.stringify({ method, startedAt: Date.now() })); } catch { /* Signup must work without storage. */ }
}

// Completion requires a confirmed, authenticated user actually created during
// this attempt. An existing Google login or Supabase's obfuscated email signup
// response is never a new registration. User IDs stay in local dedupe only.
export function trackConfirmedSignup(user: { id: string; created_at: string; email_confirmed_at?: string | null }) {
  if (!user.email_confirmed_at) return;
  try {
    const raw = localStorage.getItem(PENDING_SIGNUP);
    if (!raw) return;
    const attempt = JSON.parse(raw) as { method?: string; startedAt?: number };
    const createdAt = Date.parse(user.created_at);
    if ((attempt.method !== "Google" && attempt.method !== "email") ||
        typeof attempt.startedAt !== "number" || Date.now() - attempt.startedAt > 7 * 86400000 ||
        !Number.isFinite(createdAt) || createdAt > Date.now() + 60000 || createdAt < attempt.startedAt - 5000) {
      localStorage.removeItem(PENDING_SIGNUP);
      return;
    }
    trackOnce(`signup:${user.id}`, () => {
      trackEvent("sign_up", { method: attempt.method });
      // Keep the existing exploration's legacy completion event truthful too.
      trackEvent("signup_complete", { signup_method: attempt.method });
    }, true);
    localStorage.removeItem(PENDING_SIGNUP);
  } catch { /* Analytics never blocks authentication. */ }
}
