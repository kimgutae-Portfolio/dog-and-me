import { getSupabaseBrowserClient } from "./supabase/client";
import type { AdminPushEventType } from "./adminPush";

/** Best-effort customer-side signal; the order/message RPC remains authoritative. */
export async function notifyAdminFromCustomer(
  orderId: string,
  type: AdminPushEventType,
  eventKey?: string,
) {
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/admin/push/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId, type, eventKey }),
    });
  } catch {
    // Notifications must never block a customer's saved action.
  }
}
