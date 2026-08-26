import type { NextConfig } from "next";

// The Supabase project origin has to appear in img-src / media-src / connect-src:
// the admin screen renders signed storage URLs for photos and video, and every
// database call goes to this host. Derived from the public env var so there is
// no second place to update when the project changes.
function supabaseOrigin() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function contentSecurityPolicy() {
  const supabase = supabaseOrigin();
  const supabaseWs = supabase ? supabase.replace(/^https:/, "wss:") : null;

  return [
    "default-src 'self'",
    // 'unsafe-inline' is required by the Next.js bootstrap inline script.
    // Vercel Analytics loads its collector from va.vercel-scripts.com.
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://www.googletagmanager.com https://*.clarity.ms",
    // Inline style attributes are used throughout (thumbnails set backgroundImage).
    "style-src 'self' 'unsafe-inline'",
    [
      "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com https://*.clarity.ms https://c.bing.com",
      supabase,
    ].filter(Boolean).join(" "),
    ["media-src 'self' blob:", supabase].filter(Boolean).join(" "),
    [
      "connect-src 'self' https://vitals.vercel-insights.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.clarity.ms https://c.bing.com",
      supabase,
      supabaseWs,
    ].filter(Boolean).join(" "),
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// CSP ships in Report-Only first so a missed directive cannot black out the
// admin screen or the story form. Set CSP_ENFORCE=1 once the browser console is
// clean on /admin, /story and /film/momo-demo.
const cspHeaderName = process.env.CSP_ENFORCE === "1"
  ? "Content-Security-Policy"
  : "Content-Security-Policy-Report-Only";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: cspHeaderName, value: contentSecurityPolicy() },
        ],
      },
    ];
  },
};

export default nextConfig;
