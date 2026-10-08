"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { safeAuthNext } from "../lib/auth-navigation";
import { trackEvent } from "../lib/analytics";
import styles from "./GoogleSignIn.module.css";

export function GoogleSignIn({
  nextPath,
  disabled,
  showDivider = true,
  mode = "signup",
}: {
  nextPath: string;
  disabled: boolean;
  showDivider?: boolean;
  mode?: "login" | "signup";
}) {
  const [enabled, setEnabled] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    // This public endpoint exposes provider availability, never client secrets.
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const settings = await response.json();
        const external = settings && typeof settings === "object" && "external" in settings
          ? settings.external : null;
        if (!controller.signal.aborted) {
          setEnabled(Boolean(external && typeof external === "object" && "google" in external && external.google === true));
        }
      })
      .catch(() => { /* Keep email sign-in available if provider lookup fails. */ });
    return () => controller.abort();
  }, []);

  async function signIn() {
    if (pending || disabled) return;
    setPending(true);
    setError("");
    trackEvent(mode === "login" ? "google_login_click" : "google_signup_click", {
      next_path: nextPath,
    });
    try {
      const callback = new URL("/auth", window.location.origin);
      callback.searchParams.set("next", safeAuthNext(nextPath));
      const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } },
      });
      if (authError) throw authError;
    } catch {
      setError("Googleとの接続を開始できませんでした。もう一度お試しいただくか、メールアドレスで続けてください。");
      setPending(false);
    }
  }

  if (!enabled) return null;
  return <div className={styles.root}>
    <button type="button" className={styles.button} disabled={pending || disabled} onClick={signIn}>
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.88 46.98 24.55Z"/>
        <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.78 24c0-1.59.27-3.13.75-4.59l-7.98-6.19A23.8 23.8 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/>
      </svg>
      <span>
        {pending
          ? "Googleに接続しています…"
          : mode === "login"
            ? "Googleでログインする"
            : "Googleで無料登録する"}
      </span>
    </button>
    <p className={styles.note}>
      {mode === "login"
        ? "登録時に使用したGoogleアカウントを選んでください。"
        : "約1分で登録できます。登録だけでは料金は発生しません。"}
    </p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {showDivider && <div className={styles.divider}>またはメールアドレスで</div>}
  </div>;
}
