import { headers } from "next/headers";
import { DEFAULT_SITE_ORIGIN } from "./site";

export async function getRequestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || requestHeaders.get("host")?.trim();
  const host = requestHost && /^[a-z0-9.-]+(?::\d+)?$/i.test(requestHost)
    ? requestHost
    : new URL(DEFAULT_SITE_ORIGIN).host;
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : host.startsWith("localhost")
      ? "http"
      : "https";

  return `${protocol}://${host}`;
}
