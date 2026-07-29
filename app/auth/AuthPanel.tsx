"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

type AuthMode = "login" | "signup" | "reset";

function requestedMode(value: string | null): AuthMode {
  return value === "signup" || value === "reset" ? value : "login";
}

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/studio";
}

function friendlyError(message: string) {
  // The lockout hook rejects with a Japanese message of its own; surface it as-is
  // so the user learns the account is locked rather than seeing "wrong password".
  if (/ロック/.test(message)) return message;
  if (/invalid login credentials/i.test(message)) return "メールアドレスまたはパスワードをご確認ください。";
  if (/already registered|already been registered/i.test(message)) return "このメールアドレスはすでに登録されています。";
  if (/password/i.test(message) && /least/i.test(message)) return "パスワードは8文字以上で入力してください。";
  if (/rate limit|too many requests/i.test(message)) return "試行回数が多すぎます。しばらく時間をおいてからお試しください。";
  if (/invalid.*(totp|code)|mfa/i.test(message)) return "認証コードをご確認ください。";
  return "処理を完了できませんでした。少し時間をおいてお試しください。";
}


export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, profile } = useAuth();
  const nextPath = useMemo(() => safeNext(searchParams.get("next")), [searchParams]);
  const signupNextPath = nextPath === "/studio" ? "/story" : nextPath;
  const [mode, setMode] = useState<AuthMode>(() => requestedMode(searchParams.get("mode")));
  const [petName, setPetName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    if (!loading && user && !searchParams.get("confirmed")) router.replace(nextPath);
  }, [loading, nextPath, router, searchParams, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const supabase = getSupabaseBrowserClient();

    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?confirmed=1&next=${encodeURIComponent("/studio")}`,
        });
        if (resetError) throw resetError;
        setMessage("パスワード再設定用のメールをお送りしました。");
        return;
      }

      if (mode === "signup") {
        if (!petName.trim()) {
          setError("愛犬のお名前を入力してください。");
          return;
        }
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() || null, pet_name: petName.trim() },
            emailRedirectTo: `${window.location.origin}/auth?confirmed=1&next=${encodeURIComponent(signupNextPath)}`,
          },
        });
        if (signupError) throw signupError;
        if (data.session) router.replace(signupNextPath);
        else setMessage("確認メールをお送りしました。メール内のリンクを開いて登録を完了してください。");
        return;
      }

      // Sign-in goes through the server so failed attempts are counted and the
      // account can be locked; see app/api/auth/login/route.ts.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => null) as
        { access_token?: string; refresh_token?: string; error?: string } | null;

      if (!response.ok || !result?.access_token || !result.refresh_token) {
        setError(result?.error === "account_locked"
          ? "ログインの失敗が続いたため、アカウントを一時的にロックしています。30分ほどおいてから、もう一度お試しください。"
          : "メールアドレスまたはパスワードをご確認ください。");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sessionError) throw sessionError;

      // Second factor, when this account has one enrolled.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
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
      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;
      const factor = factors?.totp?.[0];
      if (!factor) throw new Error("mfa factor not found");

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
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
          <Link className="brand" href="/"><span className="brand-mark">WM</span><span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span></Link>
          <p className="eyebrow">TWO-FACTOR AUTHENTICATION</p>
          <h1>認証コードを入力してください。</h1>
          <p className="auth-lead">認証アプリに表示されている 6 桁のコードを入力してください。</p>
          <form onSubmit={submitMfa} className="auth-form">
            <label>
              <span>認証コード</span>
              <input
                required
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary" type="submit" disabled={pending || mfaCode.length !== 6}>
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

  if (loading || (user && !searchParams.get("confirmed"))) {
    return <div className="wizard-loading">思い出づくりを準備しています…</div>;
  }

  if (user && searchParams.get("confirmed")) {
    const registeredPetName = profile?.primary_pet_name || user.user_metadata?.pet_name;
    return (
      <main className="auth-page"><section className="auth-card auth-complete">
        <span className="auth-success-mark">✓</span>
        <p className="eyebrow">WELCOME TO WAN MEMORY</p>
        <h1>ログインできました。</h1>
        <p>{registeredPetName ? `${registeredPetName}ちゃんの思い出映像づくりを始めましょう。` : `${profile?.full_name || user.email}さまの制作室をご用意しています。`}</p>
        <Link className="button button-primary" href={nextPath}>制作室へ進む →</Link>
      </section></main>
    );
  }

  return (
    <main className="auth-page">
      <Link className="auth-back" href="/">← トップへ戻る</Link>
      <section className="auth-card">
        <Link className="brand" href="/"><span className="brand-mark">WM</span><span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span></Link>
        <p className="eyebrow">YOUR PRIVATE STUDIO</p>
        <h1>{mode === "signup" ? "はじめての方へ" : mode === "reset" ? "パスワードを再設定" : "おかえりなさい"}</h1>
        <p className="auth-lead">{mode === "signup" ? "制作状況と完成映像を、ひとつの制作室で大切にお預かりします。" : mode === "reset" ? "登録したメールアドレスへ再設定リンクをお送りします。" : "写真の追加から完成映像のお届けまで、こちらでご確認いただけます。"}</p>
        {mode !== "reset" && <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>ログイン</button><button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>会員登録</button></div>}
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && <>
            <label><span>愛犬のお名前 <em>必須</em></span><input required value={petName} onChange={(event) => setPetName(event.target.value)} autoComplete="off" placeholder="例：ひなた" /></label>
            <label><span>飼い主さまのお名前 <small>任意</small></span><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="例：山田 花子" /></label>
            <p className="auth-prefill-note">愛犬のお名前は、次の申込フォームへ自動で引き継がれます。</p>
          </>}
          <label><span>メールアドレス</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" /></label>
          {mode !== "reset" && <label><span>パスワード</span><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="8文字以上" /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={pending}>{pending ? "送信しています…" : mode === "signup" ? "登録して制作を始める →" : mode === "reset" ? "再設定メールを送る →" : "ログイン →"}</button>
        </form>
        {mode === "login" && <button className="auth-text-button" type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>パスワードを忘れた方</button>}
        {mode === "reset" && <button className="auth-text-button" type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>ログインへ戻る</button>}
        <p className="auth-privacy">お預かりした写真とお話は、制作目的以外には使用しません。</p>
      </section>
    </main>
  );
}
