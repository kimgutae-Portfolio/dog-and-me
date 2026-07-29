import { NextRequest, NextResponse } from "next/server";

// Admin screen IP allowlist.
//
// This is an ADDITIONAL layer, not a replacement for authorisation. Postgres RLS
// and the security-definer RPCs remain the real boundary — this only stops the
// /admin bundle from being served to arbitrary clients.
//
// FAIL-OPEN BY DESIGN: with ADMIN_ALLOWED_IPS unset, every request passes. A
// solo operator on a dynamic home IP must never be able to permanently lock
// themselves out of their own admin screen; clearing the env var in Vercel is
// the documented recovery path. The trade-off is that the restriction only
// exists once the variable is actually set.
export const config = { matcher: ["/admin/:path*"] };

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isPrivate(ip: string) {
  if (LOOPBACK.has(ip)) return true;
  // Local development and any private network reach the admin screen freely —
  // `npm run dev:operator` (film assembly) depends on it.
  return /^10\./.test(ip)
    || /^192\.168\./.test(ip)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    || /^fc00:/i.test(ip)
    || /^fd/i.test(ip)
    || /^fe80:/i.test(ip);
}

function ipToLong(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

/** Supports plain addresses and IPv4 CIDR (e.g. 203.0.113.0/24). */
function matches(ip: string, rule: string) {
  if (!rule.includes("/")) return ip === rule;
  const [network, bitsRaw] = rule.split("/");
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipLong = ipToLong(ip);
  const netLong = ipToLong(network);
  if (ipLong === null || netLong === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipLong & mask) === (netLong & mask);
}

function clientIp(request: NextRequest) {
  // On Vercel the left-most x-forwarded-for entry is the real client.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? "";
}

export function middleware(request: NextRequest) {
  const allowlist = (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (allowlist.length === 0) return NextResponse.next();

  const ip = clientIp(request);
  if (!ip || isPrivate(ip)) return NextResponse.next();
  if (allowlist.some((rule) => matches(ip, rule))) return NextResponse.next();

  // 404 rather than 403: do not confirm that an admin screen exists here.
  return new NextResponse(null, { status: 404 });
}
