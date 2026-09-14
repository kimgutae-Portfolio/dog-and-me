"use client";

import { useEffect, useState } from "react";
import { isMemoryAddress, memoryAddressPath } from "../lib/memory-address";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import styles from "./MemoryAddressForm.module.css";

type Props = { orderId: string; origin: string; onSaved: () => Promise<void> };
type Status = "idle" | "checking" | "available" | "taken" | "invalid" | "error" | "locked" | "current";
const messages: Record<Status, string> = {
  idle: "例：my-lovely-dog、moka-and-me。お名前の英語表記でなくても大丈夫です。",
  checking: "使えるURLか確認しています…",
  available: "このURLを使えます。",
  taken: "このURLはすでに使われています。別の言葉をお試しください。",
  invalid: "半角英小文字・数字・ハイフンで3〜40文字。ハイフンは文字の間に1つずつ使えます。",
  error: "確認できませんでした。時間をおいて入力し直してください。",
  current: "現在のURLです。このままお使いいただけます。",
  locked: "URLはすでに確定されています。ページを再読み込みしてください。",
};

export function MemoryAddressForm({ orderId, origin, onSaved }: Props) {
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!isMemoryAddress(draft)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await getSupabaseBrowserClient().rpc("manage_memory_address", {
          p_order_id: orderId, p_action: "check", p_slug: draft,
        });
        if (!cancelled) setStatus(error ? "error" : data?.status === "available" ? "available" : data?.status === "taken" ? "taken" : data?.status === "current" ? "current" : data?.status === "locked" ? "locked" : "invalid");
      } catch { if (!cancelled) setStatus("error"); }
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [draft, orderId]);

  return (
    <form className={styles.form} onSubmit={async (event) => {
      event.preventDefault();
      if (saving || saved || status !== "available" || !isMemoryAddress(draft)) return;
      setSaving(true);
      try {
        const { data, error } = await getSupabaseBrowserClient().rpc("manage_memory_address", {
          p_order_id: orderId, p_action: "set", p_slug: draft,
        });
        if (error) { setStatus("error"); return; }
        if (data?.status !== "saved") {
          setStatus(data?.status === "taken" ? "taken" : data?.status === "current" ? "current" : data?.status === "locked" ? "locked" : "invalid");
          return;
        }
        setSaved(true);
        await onSaved();
      } catch { setStatus("error"); }
      finally { setSaving(false); }
    }}>
      <label htmlFor={`memory-address-${orderId}`}>新しいURLを入力してください</label>
      <div className={styles.input}>
        <span>/memory/</span>
        <input id={`memory-address-${orderId}`} value={draft} maxLength={40}
          placeholder="my-lovely-dog" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          autoComplete="off" disabled={saving || saved}
          aria-describedby={`memory-address-status-${orderId} memory-address-note-${orderId}`}
          aria-invalid={status === "invalid" || status === "taken"}
          onChange={(event) => {
            const next = event.target.value.toLowerCase();
            setDraft(next);
            setStatus(!next ? "idle" : isMemoryAddress(next) ? "checking" : "invalid");
          }} />
      </div>
      <p id={`memory-address-status-${orderId}`} role="status" className={status === "available" ? styles.available : undefined}>
        {saved ? "URLを保存しました。表示が更新されない場合は再読み込みしてください。" : messages[status]}
      </p>
      {isMemoryAddress(draft) && <output className={styles.preview}>{origin}{memoryAddressPath(draft)}</output>}
      <p id={`memory-address-note-${orderId}`}>メールアドレスや本名を入れる必要はありません。変更できるのは1回だけです。変更前のURLも引き続き使えます。</p>
      <button className="button button-primary" type="submit" disabled={status !== "available" || saving || saved}>
        {saving ? "保存しています…" : "このURLに変更する（1回のみ）"}
      </button>
    </form>
  );
}
