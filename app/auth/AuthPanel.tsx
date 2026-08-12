"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { APPLICATIONS_OPEN } from "../lib/site";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

type AuthMode = "login" | "signup" | "reset" | "update-password";

function requestedMode(value: string | null): AuthMode {
  return value === "signup" ||
    value === "reset" ||
    value === "update-password"
    ? value
    : "login";
}

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/studio";
}

function friendlyError(message: string) {
  // The lockout hook rejects with a Japanese message of its own; surface it as-is
  // so the user learns the account is locked rather than seeing "wrong password".
  if (/ロック/.test(message)) return message;
  if (/invalid login credentials/i.test(message))
    return "メールアドレスまたはパスワードをご確認ください。";
  if (/already registered|already been registered/i.test(message))
    return "このメールアドレスはすでに登録されています。";
  if (/password/i.test(message) && /least/i.test(message))
    return "パスワードは8文字以上で入力してください。";
  if (/rate limit|too many requests/i.test(message))
    return "試行回数が多すぎます。しばらく時間をおいてからお試しください。";
  if (/invalid.*(totp|code)|mfa/i.test(message))
    return "認証コードをご確認ください。";
  return "処理を完了できませんでした。少し時間をおいてお試しください。";
}

function initialUrlError() {
  if (typeof window === "undefined" || !window.location.hash) return "";
  const description = new URLSearchParams(window.location.hash.slice(1)).get(
    "error_description",
  );
  return description
    ? friendlyError(decodeURIComponent(description.replace(/\+/g, " ")))
    : "";
}

export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, profile } = useAuth();
  const nextPath = useMemo(
    () => safeNext(searchParams.get("next")),
    [searchParams],
  );
  const signupNextPath = nextPath === "/studio" ? "/story" : nextPath;
  const [mode, setMode] = useState<AuthMode>(() => {
    const requested = requestedMode(searchParams.get("mode"));
    return !APPLICATIONS_OPEN && requested === "signup" ? "login" : requested;
  });
  const [petName, setPetName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialUrlError);
  const [signupConfirmationEmail, setSignupConfirmationEmail] = useState("");
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    if (
      !loading &&
      user &&
      mode !== "update-password" &&
      !searchParams.get("confirmed")
    )
      router.replace(nextPath);
  }, [loading, mode, nextPath, router, searchParams, user]);

  // A password-recovery link creates a temporary authenticated session. Keep
  // the customer on this page so they can choose the new password instead of
  // being sent straight to the studio by the normal sign-in redirect.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "PASSWORD_RECOVERY") return;
      setMode("update-password");
      setError("");
      setMessage("");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Supabase reports a failed/expired confirmation or reset link via
  // #error=...&error_description=... in the URL hash (not the query string),
  // since it reuses the same redirect used for a successful session.
  useEffect(() => {
    if (!window.location.hash) return;
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (!hashParams.get("error_description")) return;
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }, []);

  useEffect(() => {
    if (!signupConfirmationEmail) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSignupConfirmationEmail("");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [signupConfirmationEmail]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const supabase = getSupabaseBrowserClient();

    try {
      if (mode === "reset") {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!response.ok) throw new Error("password reset email unavailable");
        setMessage(
          "登録済みのメールアドレスには、WAN MEMORYから再設定メールをお送りします。メール内のボタンから新しいパスワードを設定してください。",
        );
        return;
      }

      if (mode === "update-password") {
        if (password.length < 8) {
          setError("パスワードは8文字以上で入力してください。");
          return;
        }
        if (password !== confirmPassword) {
          setError("確認用パスワードが一致していません。");
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          setError(
            "再設定リンクの有効期限が切れています。もう一度メールを送信してください。",
          );
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({
          password,
        });
        if (updateError) throw updateError;
        setPassword("");
        setConfirmPassword("");
        setPasswordUpdated(true);
        return;
      }

      if (mode === "signup") {
        if (!APPLICATIONS_OPEN) {
          setError("現在、新規会員登録は準備中です。受付開始までお待ちください。");
          return;
        }
        if (!petName.trim()) {
          setError("愛犬のお名前を入力してください。");
          return;
        }
        if (password !== confirmPassword) {
          setError("確認用パスワードが一致していません。");
          return;
        }
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim() || null,
              pet_name: petName.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth?confirmed=1&next=${encodeURIComponent(signupNextPath)}`,
          },
        });
        if (signupError) throw signupError;
        if (data.session) router.replace(signupNextPath);
        else setSignupConfirmationEmail(email.trim());
        return;
      }

      // Sign-in goes through the server so failed attempts are counted and the
      // account can be locked; see app/api/auth/login/route.ts.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json().catch(() => null)) as {
        access_token?: string;
        refresh_token?: string;
        error?: string;
      } | null;

      if (!response.ok || !result?.access_token || !result.refresh_token) {
        setError(
          result?.error === "account_locked"
            ? "ログインの失敗が続いたため、アカウントを一時的にロックしています。30分ほどおいてから、もう一度お試しください。"
            : "メールアドレスまたはパスワードをご確認ください。",
        );
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sessionError) throw sessionError;

      // Second factor, when this account has one enrolled.
      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (
        aal &&
        aal.nextLevel === "aal2" &&
        aal.nextLevel !== aal.currentLevel
      ) {
        setMfaPending(true);
        setPending(false);
        return;
      }

      router.replace(nextPath);
    } catch (caught) {
      setError(friendlyError(caught instanceof Error ? caught.message : ""));
    } finally {
      setPending(false);
    }
  };

  const submitMfa = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    try {
      const { data: factors, error: factorError } =
        await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;
      const factor = factors?.totp?.[0];
      if (!factor) throw new Error("mfa factor not found");

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      });
      if (verifyError) throw verifyError;

      // The notification was already sent when the password was accepted — that
      // is the moment worth telling the owner about, even if MFA then fails.
      router.replace(nextPath);
    } catch (caught) {
      setError(friendlyError(caught instanceof Error ? caught.message : ""));
    } finally {
      setPending(false);
    }
  };

  if (mfaPending) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <Link className="brand" href="/">
            <span className="brand-mark">WM</span>
            <span className="brand-type">
              WAN MEMORY<small>MOVING STORYBOOKS FOR YOUR DOG</small>
            </span>
          </Link>
          <p className="eyebrow">TWO-FACTOR AUTHENTICATION</p>
          <h1>認証コードを入力してください。</h1>
          <p className="auth-lead">
            認証アプリに表示されている 6 桁のコードを入力してください。
          </p>
          <form onSubmit={submitMfa} className="auth-form">
            <label>
              <span>認証コード</span>
              <input
                required
                value={mfaCode}
                onChange={(event) =>
                  setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button-primary"
              type="submit"
              disabled={pending || mfaCode.length !== 6}
            >
              {pending ? "確認中…" : "ログインする"}
            </button>
          </form>
          <button
            type="button"
            className="auth-text-button"
            onClick={async () => {
              await getSupabaseBrowserClient().auth.signOut();
              setMfaPending(false);
              setMfaCode("");
              setError("");
            }}
          >
            ← 別のアカウントでログインする
          </button>
        </section>
      </main>
    );
  }

  if (
    loading ||
    (user && mode !== "update-password" && !searchParams.get("confirmed"))
  ) {
    return <div className="wizard-loading">思い出づくりを準備しています…</div>;
  }

  if (mode === "update-password" && passwordUpdated) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-complete">
          <span className="auth-success-mark">✓</span>
          <p className="eyebrow">PASSWORD UPDATED</p>
          <h1>新しいパスワードを設定しました。</h1>
          <p>次回から、新しいパスワードでログインできます。</p>
          <Link className="button button-primary" href={nextPath}>
            制作室へ進む →
          </Link>
        </section>
      </main>
    );
  }

  if (user && searchParams.get("confirmed")) {
    const registeredPetName =
      profile?.primary_pet_name || user.user_metadata?.pet_name;
    return (
      <main className="auth-page">
        <section className="auth-card auth-complete">
          <span className="auth-success-mark">✓</span>
          <p className="eyebrow">WELCOME TO WAN MEMORY</p>
          <h1>ログインできました。</h1>
          <p>
            {registeredPetName
              ? `${registeredPetName}ちゃんの動く絵本づくりを始めましょう。`
              : `${profile?.full_name || user.email}さまの制作室をご用意しています。`}
          </p>
          <Link className="button button-primary" href={nextPath}>
            制作室へ進む →
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <Link className="auth-back" href="/">
        ← トップへ戻る
      </Link>
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">WM</span>
          <span className="brand-type">
            WAN MEMORY<small>MOVING STORYBOOKS FOR YOUR DOG</small>
          </span>
        </Link>
        <p className="eyebrow">YOUR PRIVATE STUDIO</p>
        <h1>
          {mode === "signup"
            ? "はじめての方へ"
            : mode === "reset"
              ? "パスワードを再設定"
              : mode === "update-password"
                ? "新しいパスワードを設定"
              : "おかえりなさい"}
        </h1>
        <p className="auth-lead">
          {mode === "signup"
            ? "制作状況と完成映像を、ひとつの制作室で大切にお預かりします。"
            : mode === "reset"
              ? "登録したメールアドレスへ再設定リンクをお送りします。"
              : mode === "update-password"
                ? "これからログインに使う新しいパスワードを入力してください。"
              : "写真の追加から完成映像のお届けまで、こちらでご確認いただけます。"}
        </p>
        {!APPLICATIONS_OPEN && mode === "login" && (
          <p className="auth-prefill-note">
            新規会員登録とお申し込みは現在準備中です。すでに制作室をお持ちの方はログインできます。
          </p>
        )}
        {APPLICATIONS_OPEN &&
          mode !== "reset" &&
          mode !== "update-password" && (
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              type="button"
              onClick={() => setMode("login")}
            >
              ログイン
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              type="button"
              onClick={() => setMode("signup")}
            >
              会員登録
            </button>
          </div>
        )}
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label>
                <span>
                  愛犬のお名前 <em>必須</em>
                </span>
                <input
                  required
                  value={petName}
                  onChange={(event) => setPetName(event.target.value)}
                  autoComplete="off"
                  placeholder="例：ひなた"
                />
              </label>
              <label>
                <span>
                  飼い主さまのお名前 <small>任意</small>
                </span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  placeholder="例：山田 花子"
                />
              </label>
              <p className="auth-prefill-note">
                愛犬のお名前は、次の申込フォームへ自動で引き継がれます。
              </p>
            </>
          )}
          {mode !== "update-password" && (
            <label>
              <span>メールアドレス</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              <span>
                {mode === "update-password"
                  ? "新しいパスワード"
                  : "パスワード"}
              </span>
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                placeholder="8文字以上"
              />
            </label>
          )}
          {(mode === "signup" || mode === "update-password") && (
            <label>
              <span>パスワード（確認）</span>
              <input
                required
                minLength={8}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="もう一度入力"
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          <button
            className="button button-primary auth-submit"
            type="submit"
            disabled={pending}
          >
            {pending
              ? "送信しています…"
              : mode === "signup"
                ? "登録して制作を始める →"
                : mode === "reset"
                  ? "再設定メールを送る →"
                  : mode === "update-password"
                    ? "新しいパスワードを保存 →"
                  : "ログイン →"}
          </button>
        </form>
        {mode === "login" && (
          <button
            className="auth-text-button"
            type="button"
            onClick={() => {
              setMode("reset");
              setError("");
              setMessage("");
            }}
          >
            パスワードを忘れた方はこちら
          </button>
        )}
        {mode === "reset" && (
          <button
            className="auth-text-button"
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
          >
            ログインへ戻る
          </button>
        )}
        {mode === "update-password" && !user && (
          <button
            className="auth-text-button"
            type="button"
            onClick={() => {
              setMode("reset");
              setError("");
              setMessage("");
            }}
          >
            再設定メールをもう一度送る
          </button>
        )}
        <p className="auth-privacy">
          お預かりした写真とお話は、制作目的以外には使用しません。
        </p>
      </section>
      {signupConfirmationEmail && (
        <div
          className="auth-confirmation-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target)
              setSignupConfirmationEmail("");
          }}
        >
          <section
            className="auth-confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="auth-confirmation-title"
            aria-describedby="auth-confirmation-description"
            onKeyDown={(event) => {
              if (event.key === "Tab") event.preventDefault();
            }}
          >
            <span className="auth-confirmation-mark" aria-hidden="true">
              ✉
            </span>
            <p className="eyebrow">CHECK YOUR EMAIL</p>
            <h2 id="auth-confirmation-title">確認メールを送信しました。</h2>
            <p id="auth-confirmation-description">
              <strong>{signupConfirmationEmail}</strong>{" "}
              宛てにメールをお送りしました。メール内の「メールアドレスを確認」を押すと、会員登録が完了します。
            </p>
            <aside>
              <strong>メールが見つからない場合</strong>
              <span>
                迷惑メールフォルダをご確認ください。届くまで数分かかる場合があります。
              </span>
            </aside>
            <button
              autoFocus
              className="button button-primary"
              type="button"
              onClick={() => setSignupConfirmationEmail("")}
            >
              わかりました
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
