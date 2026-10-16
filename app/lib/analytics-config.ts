export const GOOGLE_ANALYTICS_ID = "G-31J209RFN1";

// Only these public application paths may be sent to marketing analytics.
export function isAnalyticsPath(pathname: string) {
  if (pathname === "/admin" || pathname.startsWith("/admin/") ||
      pathname === "/memory" || pathname.startsWith("/memory/") ||
      (pathname.startsWith("/film/") && pathname !== "/film/moka-demo")) return false;
  const knownFirstSegments = new Set([
    "aiken-omoide-douga", "aiken-shashin-douga", "aiken-shashin-seiri", "api",
    "auth", "contact", "dog-birthday-message", "dog-photo-guide", "film", "guides",
    "inu-omoide-zukuri", "legal", "pet-loss-aiken-omoide", "privacy", "story",
    "start", "studio", "terms", "uchinoko-kinenbi-douga",
  ]);
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  // The remaining top-level dynamic routes are customer website slugs.
  return !firstSegment || knownFirstSegments.has(firstSegment);
}

export function isProductionAnalyticsHost(hostname: string) {
  return hostname === "wanmemory.com" || hostname === "www.wanmemory.com";
}

export function analyticsPageLocation(raw: string) {
  try {
    const url = new URL(raw);
    if (!isAnalyticsPath(url.pathname)) return "";
    // Preserve only non-personal ad attribution on public landing pages. Auth
    // and Studio URLs never retain order UUIDs, OAuth tokens or session IDs.
    const campaign = new URLSearchParams();
    if (!["/auth", "/studio", "/story", "/start"].includes(url.pathname)) {
      for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "gclid", "gbraid", "wbraid"]) {
        const value = url.searchParams.get(key);
        if (value && /^[A-Za-z0-9._~+-]{1,200}$/.test(value)) campaign.set(key, value);
      }
    }
    const query = campaign.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
  } catch { return ""; }
}

export function analyticsReferrer(raw: string, currentOrigin: string) {
  try {
    const referrer = new URL(raw);
    const current = new URL(currentOrigin);
    if (referrer.protocol !== "https:" && referrer.protocol !== "http:") return "";
    const sameSite = referrer.origin === current.origin ||
      (isProductionAnalyticsHost(referrer.hostname) && isProductionAnalyticsHost(current.hostname));
    // External referrers identify the acquisition source without exposing the
    // visitor's search, social profile, path, query string or fragment.
    if (!sameSite) return referrer.origin;
    return isAnalyticsPath(referrer.pathname) ? `${referrer.origin}${referrer.pathname}` : "";
  } catch { return ""; }
}

export function storybookCommerce(value: number) {
  return {
    currency: "JPY",
    value,
    items: [{ item_id: "moving-storybook", item_name: "WAN MEMORY Moving Storybook", price: value, quantity: 1 }],
  };
}
