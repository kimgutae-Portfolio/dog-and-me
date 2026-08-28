"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const GOOGLE_TAG_MANAGER_ID = "GTM-WBMHCBXJ";
const GOOGLE_ANALYTICS_ID = "G-31J209RFN1";

// Do not load marketing analytics on operator screens or on customer-specific
// pages whose URL contains an order, share, account, or pet identifier.
function isAnalyticsPath(pathname: string) {
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/memory" ||
    pathname.startsWith("/memory/") ||
    (pathname.startsWith("/film/") && pathname !== "/film/moka-demo")
  ) {
    return false;
  }

  const knownFirstSegments = new Set([
    "admin",
    "aiken-omoide-douga",
    "aiken-shashin-douga",
    "api",
    "auth",
    "contact",
    "dog-photo-guide",
    "film",
    "legal",
    "memory",
    "privacy",
    "story",
    "studio",
    "terms",
    "uchinoko-kinenbi-douga",
  ]);
  const firstSegment = pathname.split("/").filter(Boolean)[0];

  // The remaining top-level dynamic routes are customer website slugs.
  return !firstSegment || knownFirstSegments.has(firstSegment);
}

export function GoogleTagManager() {
  const pathname = usePathname();
  const enabled = isAnalyticsPath(pathname);

  useEffect(() => {
    // GTM stays in memory during Next.js client-side navigation. This flag also
    // stops GA4 after a visitor moves from a measured page to an excluded one.
    const analyticsWindow = window as unknown as Record<string, unknown>;
    analyticsWindow[`ga-disable-${GOOGLE_ANALYTICS_ID}`] = !enabled;
  }, [enabled]);

  if (!enabled) return null;

  return (
    <Script id="google-tag-manager" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GOOGLE_TAG_MANAGER_ID}');`}
    </Script>
  );
}
