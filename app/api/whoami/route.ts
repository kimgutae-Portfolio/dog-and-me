import { NextRequest, NextResponse } from "next/server";
import { clientIp, isAdminIpAllowed, suggestedRanges } from "../../lib/admin-ip";

export const runtime = "nodejs";

/**
 * Diagnostic for the /admin IP allowlist.
 *
 * Exists because the allowlist is easy to get wrong — a home connection may
 * reach Vercel over IPv6 while `curl api.ipify.org` reported IPv4, and consumer
 * IPs rotate. Without this, a mismatch presents only as an opaque 404.
 *
 * Returning the caller's own address to the caller discloses nothing they do
 * not already know, and `allowed` is information they can obtain anyway by
 * requesting /admin.
 */
export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  return NextResponse.json(
    {
      ip,
      allowed: isAdminIpAllowed(ip),
      restrictionActive: Boolean((process.env.ADMIN_ALLOWED_IPS ?? "").trim()),
      // Consumer IPs rotate, so a single address is usually the wrong thing to
      // register. These are the ranges this address belongs to, narrowest first.
      suggestedRanges: suggestedRanges(ip),
      hint: "IP が変わり続ける場合は、ip ではなく suggestedRanges の cidr を ADMIN_ALLOWED_IPS に登録してください（カンマ区切り）。空にすると制限は無効になります。",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
