"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

const CONFIRMATION_TEXT = "退会する";

function deletionErrorMessage(code: string) {
  if (code === "invalid_password") return "現在のパスワードが違います。";
  if (code === "confirmation_required")
    return `確認欄に「${CONFIRMATION_TEXT}」と入力してください。`;
  if (code === "admin_account_forbidden")
    return "運営者アカウントはこの画面から削除できません。";
  return "退会処理を完了できませんでした。時間をおいて、もう一度お試しください。";
}

export function AccountDeletion() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleting, open]);

  if (!user || profile?.role !== "customer") return null;

  const close = () => {
    if (deleting) return;
    setOpen(false);
    setPassword("");
    setConfirmation("");
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (deleting) return;
    setDeleting(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("unauthorized");

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, confirmation }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "deletion_failed");

      window.localStorage.removeItem("kimi-film-draft");
      window.localStorage.removeItem(`wan-memory-story-draft-${user.id}`);
      window.localStorage.removeItem("wan-memory-pending-order-id");
      try {
        await signOut();
      } catch {
        await supabase.auth.signOut({ scope: "local" });
      }
      router.replace("/auth?deleted=1");
      router.refresh();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "deletion_failed";
      setError(deletionErrorMessage(code));
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        className="studio-account-delete-button"
        type="button"
        onClick={() => setOpen(true)}
        role="menuitem"
      >
        会員を退会する
      </button>
      {open && (
        <div
          className="account-deletion-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <section
            className="account-deletion-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="account-deletion-title"
            aria-describedby="account-deletion-description"
          >
            <button
              className="account-deletion-close"
              type="button"
              onClick={close}
              disabled={deleting}
              aria-label="閉じる"
            >
              ×
            </button>
            <p className="eyebrow">ACCOUNT SETTINGS</p>
            <h2 id="account-deletion-title">アカウントを削除する</h2>
            <p id="account-deletion-description">
              退会すると、WAN MEMORYに保存された注文、文章、写真・映像、メッセージ、専用ホームページを完全に削除します。元に戻すことはできません。
            </p>
            <aside>
              <strong>同じメールアドレスで、いつでも再登録できます。</strong>
              <span>
                再登録後は新しいアカウントとなり、以前のデータは一切引き継がれません。法令上保存が必要な決済記録とStripe側の取引記録は、この削除の対象外です。
              </span>
            </aside>
            <form onSubmit={submit}>
              <label>
                <span>現在のパスワード</span>
                <input
                  autoFocus
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                <span>
                  確認のため「<b>{CONFIRMATION_TEXT}</b>」と入力
                </span>
                <input
                  required
                  autoComplete="off"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
              {error && (
                <p className="account-deletion-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button account-deletion-submit"
                type="submit"
                disabled={
                  deleting ||
                  !password ||
                  confirmation.trim() !== CONFIRMATION_TEXT
                }
              >
                {deleting ? "すべてのデータを削除しています…" : "退会してデータを削除する"}
              </button>
              <button
                className="auth-text-button"
                type="button"
                onClick={close}
                disabled={deleting}
              >
                キャンセル
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
