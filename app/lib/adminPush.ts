import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush, { type PushSubscription } from "web-push";

export type AdminPushEventType =
  | "order_submitted"
  | "customer_message"
  | "customer_revision"
  | "stills_change_requested"
  | "stills_approved"
  | "review_approved"
  | "payment_succeeded";

const EVENT_COPY: Record<
  AdminPushEventType,
  { title: string; body: (petName: string, orderNumber: string) => string }
> = {
  order_submitted: {
    title: "新しいご相談",
    body: (petName, orderNumber) => `${petName}ちゃん（${orderNumber}）の素材が届きました。`,
  },
  customer_message: {
    title: "お客様からメッセージ",
    body: (petName, orderNumber) => `${petName}ちゃん（${orderNumber}）について新しいメッセージがあります。`,
  },
  customer_revision: {
    title: "映像の修正依頼",
    body: (petName, orderNumber) => `${petName}ちゃん（${orderNumber}）の修正依頼を受け付けました。`,
  },
  stills_change_requested: {
    title: "絵本ページの調整依頼",
    body: (petName, orderNumber) => `${petName}ちゃん（${orderNumber}）の絵本ページに調整依頼があります。`,
  },
  stills_approved: {
    title: "絵本ページが承認されました",
    body: (petName, orderNumber) => `${petName}ちゃん（${orderNumber}）の動画制作へ進められます。`,
  },
  review_approved: {
    title: "完成前映像が承認されました",
    body: (petName, orderNumber) => `${petName}ちゃん（${orderNumber}）の最終納品準備へ進められます。`,
  },
  payment_succeeded: {
    title: "決済が完了しました",
    body: (petName, orderNumber) => `${petName}ちゃん（${orderNumber}）の入金を確認しました。`,
  },
};

type AdminPushResult = {
  notified: number;
  notificationIds: string[];
  reason?: "not_configured" | "no_admin" | "order_not_found";
};

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function vapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = (process.env.VAPID_SUBJECT || "mailto:info@wanmemory.com").trim();
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

function isExpiredPushError(error: unknown) {
  const statusCode = (error as { statusCode?: number } | null)?.statusCode;
  return statusCode === 404 || statusCode === 410;
}

export async function notifyAdmins({
  orderId,
  type,
  eventKey,
}: {
  orderId: string;
  type: AdminPushEventType;
  eventKey?: string;
}): Promise<AdminPushResult> {
  const admin = adminClient();
  const copy = EVENT_COPY[type];
  if (!admin || !copy) return { notified: 0, notificationIds: [], reason: "not_configured" };

  const [{ data: order }, { data: profiles }] = await Promise.all([
    admin.from("orders").select("id,pet_name,order_number").eq("id", orderId).maybeSingle(),
    (() => {
      const targetId = process.env.ADMIN_PUSH_TARGET_USER_ID?.trim();
      let query = admin.from("profiles").select("id").eq("role", "admin");
      if (targetId) query = query.eq("id", targetId);
      return query;
    })(),
  ]);
  if (!order) return { notified: 0, notificationIds: [], reason: "order_not_found" };
  if (!profiles?.length) return { notified: 0, notificationIds: [], reason: "no_admin" };

  const config = vapidConfig();
  if (config) webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const origin = (process.env.SITE_ORIGIN || "https://kimi-to-no-eiga.ggutae0.chatgpt.site").replace(/\/+$/, "");
  const href = `${origin}/admin?order=${encodeURIComponent(orderId)}`;
  const dedupeKey = `${type}:${orderId}:${eventKey?.trim() || "event"}`;
  const title = copy.title;
  const body = copy.body(order.pet_name, order.order_number);
  const notificationIds: string[] = [];
  let notified = 0;

  for (const profile of profiles as Array<{ id: string }>) {
    const { data: existing } = await admin
      .from("admin_notifications")
      .select("id,push_status")
      .eq("admin_user_id", profile.id)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (existing?.push_status === "sent") {
      notificationIds.push(existing.id);
      continue;
    }

    const { data: notification, error: notificationError } = existing
      ? await admin
          .from("admin_notifications")
          .update({ title, body, href, order_id: orderId, notification_type: type, push_status: "pending", error_message: null })
          .eq("id", existing.id)
          .select("id")
          .single()
      : await admin
          .from("admin_notifications")
          .insert({ admin_user_id: profile.id, order_id: orderId, notification_type: type, title, body, href, dedupe_key: dedupeKey })
          .select("id")
          .single();
    if (notificationError || !notification) continue;
    notificationIds.push(notification.id);

    const { data: subscriptions } = await admin
      .from("admin_push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("admin_user_id", profile.id);
    if (!config) {
      await admin.from("admin_notifications").update({ push_status: "not_configured" }).eq("id", notification.id);
      continue;
    }
    if (!subscriptions?.length) {
      await admin.from("admin_notifications").update({ push_status: "not_subscribed" }).eq("id", notification.id);
      continue;
    }

    let delivered = 0;
    let expired = false;
    let lastError = "";
    const payload = JSON.stringify({ notificationId: notification.id, title, body, href, type });
    for (const subscription of subscriptions as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>) {
      const pushSubscription: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };
      try {
        await webpush.sendNotification(pushSubscription, payload, { TTL: 86400, urgency: "high" });
        delivered += 1;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "push_failed";
        if (isExpiredPushError(error)) {
          expired = true;
          await admin.from("admin_push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }
    const pushStatus = delivered > 0 ? "sent" : expired ? "expired" : "failed";
    await admin
      .from("admin_notifications")
      .update({ push_status: pushStatus, delivery_count: delivered, error_message: delivered > 0 ? null : lastError.slice(0, 500) })
      .eq("id", notification.id);
    if (delivered > 0) notified += 1;
  }

  return { notified, notificationIds };
}
