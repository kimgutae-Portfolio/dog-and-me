"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type { MemoryOrder, OrderMessage } from "../lib/supabase/types";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ChatWidget({
  order,
  currentUserId,
  canOperate,
  messages,
  messageBody,
  onMessageBodyChange,
  sending,
  onSend,
  onMessageReceived,
  onMessagesRead,
}: {
  order: MemoryOrder;
  currentUserId: string;
  canOperate: boolean;
  messages: OrderMessage[];
  messageBody: string;
  onMessageBodyChange: (value: string) => void;
  sending: boolean;
  onSend: (event: FormEvent) => void;
  onMessageReceived: (message: OrderMessage) => void;
  onMessagesRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const markedThroughRef = useRef<string | null>(null);

  const unreadCount = useMemo(
    () =>
      messages.filter((m) => m.sender_id !== currentUserId && !m.read_at)
        .length,
    [messages, currentUserId],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // The topic includes a random suffix so this always gets a brand-new
    // channel object. supabase-js reuses an existing channel by exact topic
    // string, and removeChannel()'s unsubscribe is async — without the
    // suffix, an effect re-run before the previous channel finished tearing
    // down (e.g. React Strict Mode's mount/cleanup/mount in dev) would get
    // back that still-joining channel and crash calling .on() on it.
    const channel = supabase
      .channel(`order-messages-${order.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `order_id=eq.${order.id}`,
        },
        (payload) => {
          onMessageReceived(payload.new as OrderMessage);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  useEffect(() => {
    if (!open || unreadCount === 0) return;
    const latestId = messages[messages.length - 1]?.id ?? null;
    if (markedThroughRef.current === latestId) return;
    markedThroughRef.current = latestId;
    getSupabaseBrowserClient()
      .rpc("mark_order_messages_read", { p_order_id: order.id })
      .then(({ error }) => {
        if (!error) onMessagesRead();
      });
  }, [open, unreadCount, messages, order.id, onMessagesRead]);

  useEffect(() => {
    if (!open) return;
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [open, messages]);

  return (
    <div className="chat-widget">
      {open && (
        <section
          className="chat-widget-panel"
          role="dialog"
          aria-label="担当者とのメッセージ"
        >
          <header className="chat-widget-header">
            <div>
              <p className="eyebrow">MESSAGE</p>
              <h2>担当ディレクターとのメッセージ</h2>
            </div>
            <button
              type="button"
              className="chat-widget-close"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
            >
              ×
            </button>
          </header>
          <div className="message-thread chat-widget-thread" ref={threadRef}>
            {!messages.length && (
              <div className="message-notification-note">
                <span aria-hidden="true">✉</span>
                <p>
                  <strong>担当者からの確認やお願いはこちらに届きます。</strong>
                  <small>
                    新しいメッセージは、ご登録のメールアドレスにもお知らせします。
                  </small>
                </p>
              </div>
            )}
            {messages.length ? (
              messages.map((message) => {
                const fromCustomer = message.sender_id === order.user_id;
                return (
                  <article
                    className={fromCustomer ? "mine" : ""}
                    key={message.id}
                  >
                    <small>
                      {fromCustomer ? "あなた" : "担当ディレクター"} ·{" "}
                      {formatTime(message.created_at)}
                    </small>
                    <p>{message.body}</p>
                  </article>
                );
              })
            ) : (
              <p className="message-empty">
                追加したい思い出やご質問をこちらから送れます。
              </p>
            )}
          </div>
          {canOperate ? (
            <form className="message-form" onSubmit={onSend}>
              <textarea
                required
                value={messageBody}
                onChange={(event) => onMessageBodyChange(event.target.value)}
                rows={2}
                maxLength={3000}
                placeholder="担当者へ伝えたいこと"
              />
              <button
                className="button button-outline message-send-button"
                type="submit"
                disabled={sending}
              >
                {sending ? "送信中…" : "送信する"}
              </button>
            </form>
          ) : (
            <p className="readonly-preview-note">
              閲覧専用プレビューではメッセージを送信できません。
            </p>
          )}
        </section>
      )}
      <button
        type="button"
        className="chat-widget-toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? "担当者とのメッセージ（未読あり）"
            : "担当者とのメッセージ"
        }
      >
        {open ? "×" : "✉"}
        {!open && unreadCount > 0 && (
          <span className="chat-widget-badge" aria-hidden="true">
            !
          </span>
        )}
      </button>
    </div>
  );
}
