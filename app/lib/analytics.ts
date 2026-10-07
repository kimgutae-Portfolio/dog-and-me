"use client";

type AnalyticsValue = string | number | boolean | null | undefined;

export function trackEvent(
  event: string,
  values: Record<string, AnalyticsValue> = {},
) {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as typeof window & {
    dataLayer?: Array<Record<string, AnalyticsValue>>;
  };
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  analyticsWindow.dataLayer.push({ event, ...values });
}
