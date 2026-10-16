"use client";

import { analyticsPageLocation, analyticsReferrer, GOOGLE_ANALYTICS_ID, isAnalyticsPath, isProductionAnalyticsHost } from "./analytics-config";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsWindow = typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
const directlyForwarded = new Set([
  "sign_up", "signup_confirmation_sent", "proposal_view", "proposal_select",
  "begin_checkout", "checkout_error", "checkout_cancel", "purchase",
]);
const memoryDedupe = new Set<string>();

function analyticsWindow() {
  if (typeof window === "undefined" || !isAnalyticsPath(window.location.pathname)) return null;
  const target = window as AnalyticsWindow;
  target.dataLayer = target.dataLayer || [];
  return target;
}

export function analyticsCommand(...args: unknown[]) {
  const target = analyticsWindow();
  if (!target) return;
  // gtag's dataLayer protocol uses Arguments objects, not custom-event objects.
  // eslint-disable-next-line prefer-rest-params
  target.gtag = target.gtag || function () { target.dataLayer!.push(arguments); };
  target.gtag(...args);
}

export function updateAnalyticsLocation() {
  if (typeof window === "undefined") return;
  analyticsCommand("set", {
    page_location: analyticsPageLocation(window.location.href),
    page_referrer: analyticsReferrer(document.referrer, window.location.origin),
  });
}

export function trackEvent(
  event: string,
  values: Record<string, AnalyticsValue> = {},
) {
  const target = analyticsWindow();
  if (!target) return;
  updateAnalyticsLocation();
  if (directlyForwarded.has(event)) {
    // The published GTM v3 trigger already sends legacy start/story/auth events.
    // New events go to the existing Google tag directly, not a second GTM trigger.
    analyticsCommand("event", event, {
      ...values,
      send_to: GOOGLE_ANALYTICS_ID,
      page_location: analyticsPageLocation(window.location.href),
      page_referrer: analyticsReferrer(document.referrer, window.location.origin),
    });
  } else target.dataLayer!.push({ event, ...values });
}

export function trackCommerceEvent(event: "begin_checkout" | "purchase", values: Record<string, unknown>) {
  const target = analyticsWindow();
  if (!target) return;
  updateAnalyticsLocation();
  analyticsCommand("event", event, { ...values, send_to: GOOGLE_ANALYTICS_ID,
    page_location: analyticsPageLocation(window.location.href), page_referrer: analyticsReferrer(document.referrer, window.location.origin) });
}

export function trackOnce(key: string, send: () => void, persistent = false) {
  if (!analyticsWindow() || memoryDedupe.has(key)) return;
  let storage: Storage | undefined;
  try {
    storage = persistent ? window.localStorage : window.sessionStorage;
    if (storage.getItem(`wm-analytics:${key}`)) return;
  } catch { /* Private browsing may disable storage. */ }
  memoryDedupe.add(key);
  send();
  try { storage?.setItem(`wm-analytics:${key}`, "1"); } catch { /* In-memory dedupe remains. */ }
}

export function productionAnalyticsEnabled() {
  return typeof window !== "undefined" && isProductionAnalyticsHost(window.location.hostname);
}
