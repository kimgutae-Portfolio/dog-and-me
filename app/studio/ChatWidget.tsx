"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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

const ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

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
  open,
  onOpenChange,
}: {
  order: MemoryOrder;
  currentUserId: string;
  canOperate: boolean;
  messages: OrderMessage[];
  sending: boolean;
  onSend: (body: string, attachmentFile?: File) => Promise<boolean>;
  onMessageReceived: (message: OrderMessage) => void;
  onMessagesRead: () => void;
  onRefreshMessages: () => void;
  // Controlled from the parent so other UI (e.g. the "担当者へ連絡する" next-action
  // button) can open this panel imperatively — it used to be an in-page #messages
  // anchor before this became a floating widget with nothing to scroll to.
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const panelId = useId();
  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markedThroughRef = useRef<string | null>(null);
  const messageReceivedRef = useRef(onMessageReceived);
  const refreshMessagesRef = useRef(onRefreshMessages);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null,
  );
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>(
    {},
  );
  const knownAttachmentPathsRef = useRef(new Set<string>());

  // A customer's own order is always allowed to receive a message. Other
  // controls may be read-only (for example while an admin previews the page),
  // but that must not hide the customer's conversation composer.
  const canCompose = canOperate || currentUserId === order.user_id;

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  useEffect(() => {
    messageReceivedRef.current = onMessageReceived;
    refreshMessagesRef.current = onRefreshMessages;
  }, [onMessageReceived, onRefreshMessages]);

  useEffect(() => {
    if (open) refreshMessagesRef.current();
  }, [open]);

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

  // Signed URLs for storage-backed attachments (optimistic ones use a local
  // blob: URL directly and never reach this). Fetched once per path — the ref
  // set tracks what's already been requested so a re-render with the same
  // paths doesn't refetch, while attachmentUrls state is what triggers the
  // re-render that actually shows the image once ready.
  useEffect(() => {
    const newPaths = messages
      .map((message) => message.attachment_path)
      .filter(
        (path): path is string =>
          !!path &&
          !path.startsWith("blob:") &&
          !knownAttachmentPathsRef.current.has(path),
      );
    if (!newPaths.length) return;
    newPaths.forEach((path) => knownAttachmentPathsRef.current.add(path));
    getSupabaseBrowserClient()
      .storage.from("order-assets")
      .createSignedUrls(newPaths, 3600)
      .then(({ data }) => {
        if (!data) return;
        setAttachmentUrls((current) => {
          const next = { ...current };
          for (const item of data)
            if (item.signedUrl && item.path) next[item.path] = item.signedUrl;
          return next;
        });
      });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const handleAttachmentPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAttachmentError("");
    if (!file.type.startsWith("image/")) {
      setAttachmentError("写真（JPEG・PNG・WebP・HEIC）を選んでください。");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError("写真1枚の上限は20MBです。");
      return;
    }
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const clearPendingAttachment = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setAttachmentError("");
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing)
      return;
    event.preventDefault();
    if (!sending && (event.currentTarget.value.trim() || pendingFile))
      event.currentTarget.form?.requestSubmit();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const body = textareaRef.current?.value.trim() ?? "";
    if (sending || (!body && !pendingFile)) return;
    if (await onSend(body, pendingFile ?? undefined)) {
      if (textareaRef.current) textareaRef.current.value = "";
      clearPendingAttachment();
    }
  };

  const widget = (
    <div className="chat-widget">
      {open && (
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
            <button
              type="button"
              className="chat-widget-close"
              aria-label="閉じる"
              onClick={(event) => {
                event.stopPropagation();
                onOpenChange(false);
              }}
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
                const attachmentUrl = message.attachment_path
                  ? message.attachment_path.startsWith("blob:")
                    ? message.attachment_path
                    : attachmentUrls[message.attachment_path]
                  : null;
                return (
                  <article
                    className={fromCustomer ? "mine" : ""}
                    key={message.id}
                  >
                    <small>
                      {fromCustomer ? "あなた" : "担当ディレクター"} ·{" "}
                      {formatTime(message.created_at)}
                    </small>
                    {message.body && <p>{message.body}</p>}
                    {attachmentUrl && (
                      <a
                        className="chat-widget-attachment"
                        href={attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img src={attachmentUrl} alt="添付写真" />
                      </a>
                    )}
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
              {pendingPreviewUrl && (
                <div className="chat-widget-pending-attachment">
                  <img src={pendingPreviewUrl} alt="送信する写真のプレビュー" />
                  <button
                    type="button"
                    aria-label="写真を取り消す"
                    onClick={clearPendingAttachment}
                  >
                    ×
                  </button>
                </div>
              )}
              {attachmentError && (
                <p className="chat-widget-attachment-error">{attachmentError}</p>
              )}
              <textarea
                ref={textareaRef}
                required={!pendingFile}
                onKeyDown={handleComposerKeyDown}
                rows={2}
                maxLength={3000}
                placeholder="担当者へ伝えたいこと"
                aria-label="担当者へ伝えたいメッセージ"
                aria-busy={sending}
              />
              <div className="chat-widget-composer-footer">
                <div className="chat-widget-composer-footer-left">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    className="chat-widget-file-input"
                    onChange={handleAttachmentPick}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    className="chat-widget-attach-button"
                    aria-label="写真を添付する"
                    disabled={sending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L9.41 17.41a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" />
                    </svg>
                  </button>
                  <small>Enterで送信 · Shift + Enterで改行</small>
                </div>
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
      )}
      {!open && (
        <button
          type="button"
          className="chat-widget-toggle"
          aria-expanded="false"
          aria-controls={panelId}
          aria-label={
            unreadCount > 0
              ? "担当者とのメッセージ（未読あり）"
              : "担当者とのメッセージ"
          }
          onClick={() => onOpenChange(true)}
        >
          <span className="chat-widget-toggle-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M20 11.5a7.2 7.2 0 0 1-7.5 7.2 8 8 0 0 1-3.3-.7L4 19l1.5-4.6A7.1 7.1 0 0 1 5 11.5 7.2 7.2 0 0 1 12.5 4 7.2 7.2 0 0 1 20 11.5Z" />
              <path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01" />
            </svg>
            {unreadCount > 0 && (
            <span className="chat-widget-badge">!</span>
            )}
          </span>
          <span className="chat-widget-toggle-label">担当者へメッセージ</span>
        </button>
      )}
    </div>
  );

  // Keep the fixed widget inside the active route tree. Next.js preserves
  // previous route trees during navigation; a body portal would escape their
  // hidden state and leave every preserved chat floating on screen.
  return widget;
}
