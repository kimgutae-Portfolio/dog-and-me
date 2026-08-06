"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type { AdminNotification } from "../lib/supabase/types";

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const pushStatusLabels: Record<AdminNotification["push_status"], string> = {
  pending: "送信準備中",
  sent: "送信済み",
  failed: "送信失敗",
  not_subscribed: "この端末が未登録",
  not_configured: "サーバー設定待ち",
  expired: "端末登録が期限切れ",
};

export function AdminPushCenter() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification === "undefined" ? "default" : Notification.permission,
  );
  const [subscribed, setSubscribed] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
    [],
  );
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as AdminNotification[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        if (supported) {
          const registration = await navigator.serviceWorker.register("/admin-push-sw.js", { scope: "/" });
          const current = await registration.pushManager.getSubscription();
          setSubscribed(Boolean(current));
        }
        await loadNotifications();
      })().catch(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifications, supported]);

  const enablePush = async () => {
    if (!supported || !publicKey || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setError("ブラウザの通知許可が必要です。ブラウザ設定から通知を許可してください。");
        return;
      }
      const registration = await navigator.serviceWorker.register("/admin-push-sw.js", { scope: "/" });
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(publicKey) as BufferSource,
        }));
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("ログイン情報を確認できませんでした。");
      const response = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...subscription.toJSON(), userAgent: navigator.userAgent }),
      });
      if (!response.ok) throw new Error("通知端末を登録できませんでした。");
      setSubscribed(true);
      setMessage("この端末で管理通知を受け取れるようになりました。");
      await loadNotifications();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "通知設定に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (notification: AdminNotification) => {
    if (notification.read_at) return;
    await getSupabaseBrowserClient()
      .from("admin_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notification.id);
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
      ),
    );
  };

  return (
    <section className="admin-push-center">
      <div className="admin-push-head">
        <div>
          <h4>管理通知（Web Push）</h4>
          <p className="admin-operation-note">
            新しい相談・お客様のメッセージ・修正依頼・決済完了を、この管理アカウントへ通知します。
          </p>
        </div>
        <span className={subscribed ? "admin-push-status on" : "admin-push-status"}>
          {subscribed ? "この端末：受信中" : "この端末：未登録"}
        </span>
      </div>
      {!supported ? (
        <p className="admin-operation-note warning">このブラウザはWeb Pushに対応していません。</p>
      ) : !publicKey ? (
        <p className="admin-operation-note warning">VAPID公開鍵の設定後に通知を有効化できます。</p>
      ) : (
        <button className="button button-primary" type="button" disabled={saving || permission === "denied"} onClick={enablePush}>
          {saving ? "登録しています…" : subscribed ? "この端末の通知を更新する" : "この端末で通知を受け取る →"}
        </button>
      )}
      {permission === "denied" && <p className="admin-operation-note warning">通知がブラウザ設定で拒否されています。</p>}
      {message && <p className="admin-operation-note" role="status">{message}</p>}
      {error && <p className="admin-operation-note warning" role="alert">{error}</p>}

      <div className="admin-push-history">
        <div className="admin-push-history-head">
          <h4>通知履歴</h4>
          <button type="button" className="text-link" onClick={() => void loadNotifications()}>更新</button>
        </div>
        {loading ? (
          <p className="admin-empty-copy">通知履歴を読み込んでいます…</p>
        ) : notifications.length === 0 ? (
          <p className="admin-empty-copy">通知履歴はまだありません。</p>
        ) : (
          <div className="admin-push-history-list">
            {notifications.map((notification) => (
              <article className={notification.read_at ? "" : "unread"} key={notification.id} onClick={() => void markRead(notification)}>
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                </div>
                <small>{formatNotificationDate(notification.created_at)} · {pushStatusLabels[notification.push_status]}</small>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
