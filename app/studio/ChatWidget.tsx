"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type { MemoryOrder, OrderMessage } from "../lib/supabase/types";

function formatTime(value: string) {
  // Realtime postgres_changes payloads carry Postgres's native timestamp
  // text ("2026-08-09 12:34:56.123+00", space-separated) instead of the
  // ISO 8601 format PostgREST normalizes to for regular selects. Safari's
  // Date parser is strict and throws on the space-separated form, which
  // would otherwise crash the whole message list mid-render.
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ChatWidget({
  order,
  currentUserId,
  canOperate,
  messages,
  sending,
  onSend,
  onMessageReceived,
  onMessagesRead,
  onRefreshMessages,
  composeRequest,
}: {
  order: MemoryOrder;
  currentUserId: string;
  canOperate: boolean;
  messages: OrderMessage[];
  sending: boolean;
  onSend: (body: string) => Promise<boolean>;
  onMessageReceived: (message: OrderMessage) => void;
  onMessagesRead: () => void;
  onRefreshMessages: () => void;
  composeRequest?: { id: number; body: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const toggleId = useId();
  const panelId = useId();
  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markedThroughRef = useRef<string | null>(null);
  const messageReceivedRef = useRef(onMessageReceived);
  const refreshMessagesRef = useRef(onRefreshMessages);

  // A customer's own order is always allowed to receive a message. Other
  // controls may be read-only (for example while an admin previews the page),
  // but that must not hide the customer's conversation composer.
  const canCompose = canOperate || currentUserId === order.user_id;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    messageReceivedRef.current = onMessageReceived;
    refreshMessagesRef.current = onRefreshMessages;
  }, [onMessageReceived, onRefreshMessages]);

  useEffect(() => {
    if (open) refreshMessagesRef.current();
  }, [open]);

  useEffect(() => {
    if (!composeRequest) return;
    let focusFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      setOpen(true);
      focusFrame = window.requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        textareaRef.current.value = composeRequest.body;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          composeRequest.body.length,
          composeRequest.body.length,
        );
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [composeRequest]);

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
          messageReceivedRef.current(payload.new as OrderMessage);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // The callback refs above keep this channel stable while the parent rerenders.
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

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing)
      return;
    event.preventDefault();
    if (!sending && event.currentTarget.value.trim())
      event.currentTarget.form?.requestSubmit();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const body = textareaRef.current?.value.trim() ?? "";
    if (sending || !body) return;
    if (await onSend(body) && textareaRef.current) textareaRef.current.value = "";
  };

  const widget = (
    <div className="chat-widget">
      <input
        className="chat-widget-control"
        id={toggleId}
        type="checkbox"
        checked={open}
        onChange={(event) => setOpen(event.currentTarget.checked)}
        aria-hidden="true"
        tabIndex={-1}
      />
      <section
        className="chat-widget-panel"
        id={panelId}
        role="dialog"
        aria-label="担当者とのメッセージ"
      >
          <header className="chat-widget-header">
            <div>
              <p className="eyebrow">MESSAGE</p>
              <h2>担当ディレクターとのメッセージ</h2>
            </div>
            <label
              htmlFor={toggleId}
              className="chat-widget-close"
              role="button"
              tabIndex={0}
              aria-label="閉じる"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
            >
              ×
            </label>
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
          {canCompose ? (
            <form className="message-form" onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
                required
                onKeyDown={handleComposerKeyDown}
                rows={2}
                maxLength={3000}
                placeholder="担当者へ伝えたいこと"
                aria-label="担当者へ伝えたいメッセージ"
                aria-busy={sending}
              />
              <div className="chat-widget-composer-footer">
                <small>Enterで送信 · Shift + Enterで改行</small>
                <button
                  className="message-send-button"
                  type="submit"
                  disabled={sending}
                >
                  <span>{sending ? "送信中…" : "送信"}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m4 4 16 8-16 8 3.2-8L4 4Z" />
                    <path d="M7.2 12H20" />
                  </svg>
                </button>
              </div>
            </form>
          ) : (
            <p className="readonly-preview-note">
              閲覧専用プレビューではメッセージを送信できません。
            </p>
          )}
      </section>
      <label
        htmlFor={toggleId}
        className={`chat-widget-toggle${open ? " is-open" : ""}`}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          unreadCount > 0
            ? "担当者とのメッセージ（未読あり）"
            : "担当者とのメッセージ"
        }
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
      >
        <span className="chat-widget-toggle-icon" aria-hidden="true">
          {open ? (
            <svg viewBox="0 0 24 24">
              <path d="m7 7 10 10M17 7 7 17" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M20 11.5a7.2 7.2 0 0 1-7.5 7.2 8 8 0 0 1-3.3-.7L4 19l1.5-4.6A7.1 7.1 0 0 1 5 11.5 7.2 7.2 0 0 1 12.5 4 7.2 7.2 0 0 1 20 11.5Z" />
              <path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01" />
            </svg>
          )}
          {!open && unreadCount > 0 && (
            <span className="chat-widget-badge">!</span>
          )}
        </span>
        {!open && (
          <span className="chat-widget-toggle-label">担当者へメッセージ</span>
        )}
      </label>
    </div>
  );

  // Render outside the studio content stack so fixed positioning and pointer
  // events cannot be intercepted by the mobile action bar or card layers.
  return mounted ? createPortal(widget, document.body) : null;
}
