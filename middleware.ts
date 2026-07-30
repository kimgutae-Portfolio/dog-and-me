import { NextRequest, NextResponse } from "next/server";
import { clientIp, isAdminIpAllowed } from "./app/lib/admin-ip";

// Admin screen IP allowlist.
//
// This is an ADDITIONAL layer, not a replacement for authorisation. Postgres RLS
// and the security-definer RPCs remain the real boundary — this only stops the
// /admin bundle from being served to arbitrary clients.
//
// FAIL-OPEN BY DESIGN: with ADMIN_ALLOWED_IPS unset, every request passes, so a
// mistake here can never permanently lock the operator out. Clearing the env var
// in Vercel is the documented recovery path.
//
// Matching lives in app/lib/admin-ip.ts so that /api/whoami reports exactly what
// this enforces. Use /api/whoami to confirm the address Vercel actually sees.
export const config = { matcher: ["/admin/:path*"] };

export function middleware(request: NextRequest) {
  if (isAdminIpAllowed(clientIp(request))) return NextResponse.next();
  // 404 rather than 403: do not confirm that an admin screen exists here.
  return new NextResponse(null, { status: 404 });
}
