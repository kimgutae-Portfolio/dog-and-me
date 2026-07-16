"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

type AuthMode = "login" | "signup" | "reset";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/studio";
}

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "メールアドレスまたはパスワードをご確認ください。";
  if (/already registered|already been registered/i.test(message)) return "このメールアドレスはすでに登録されています。";
  if (/password/i.test(message) && /least/i.test(message)) return "パスワードは8文字以上で入力してください。";
  return "処理を完了できませんでした。少し時間をおいてお試しください。";
}

export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, profile } = useAuth();
  const nextPath = useMemo(() => safeNext(searchParams.get("next")), [searchParams]);
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth?confirmed=1&next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (signupError) throw signupError;
        if (data.session) router.replace(nextPath);
        else setMessage("確認メールをお送りしました。メール内のリンクを開いて登録を完了してください。");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      router.replace(nextPath);
    } catch (caught) {
      setError(friendlyError(caught instanceof Error ? caught.message : ""));
    } finally {
      setPending(false);
    }
  };

  if (loading) return <div className="wizard-loading">制作室への入口を準備しています…</div>;

  if (user && searchParams.get("confirmed")) {
    return (
      <main className="auth-page"><section className="auth-card auth-complete">
        <span className="auth-success-mark">✓</span>
        <p className="eyebrow">WELCOME TO WAN MEMORY</p>
        <h1>ログインできました。</h1>
        <p>{profile?.full_name || user.email}さまの制作室をご用意しています。</p>
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
        <p className="auth-lead">{mode === "signup" ? "制作状況と完成した映画を、ひとつの制作室で大切にお預かりします。" : mode === "reset" ? "登録したメールアドレスへ再設定リンクをお送りします。" : "写真の追加から映画のお届けまで、こちらでご確認いただけます。"}</p>
        {mode !== "reset" && <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>ログイン</button><button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>会員登録</button></div>}
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && <label><span>お名前</span><input required value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="山田 花子" /></label>}
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
