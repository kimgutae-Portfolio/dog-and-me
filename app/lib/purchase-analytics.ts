import { createHash } from "node:crypto";

type PurchaseOrder = { payment_status: string; quoted_price: number; currency: string };
type PaidCheckout = { stripe_session_id: string | null; amount: number; currency: string; paid_at: string | null; status: string; livemode: boolean | null };

export function verifiedPurchase(order: PurchaseOrder, checkout: PaidCheckout | null, now = Date.now()) {
  if (order.payment_status !== "paid" || !Number.isSafeInteger(order.quoted_price) || order.quoted_price <= 0 || order.currency.toUpperCase() !== "JPY" ||
      !checkout?.stripe_session_id || checkout.status !== "paid" || checkout.livemode !== true || !checkout.paid_at ||
      checkout.amount !== order.quoted_price || checkout.currency.toUpperCase() !== "JPY") return null;
  // A later visit to an old delivered order must not create fresh revenue.
  const age = now - Date.parse(checkout.paid_at);
  if (!Number.isFinite(age) || age < -60_000 || age > 24 * 60 * 60 * 1000) return null;
  return {
    transaction_id: `wm_${createHash("sha256").update(checkout.stripe_session_id).digest("hex").slice(0, 32)}`,
    value: checkout.amount,
    currency: "JPY",
  };
}
