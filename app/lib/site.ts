import { headers } from "next/headers";

export const SITE_NAME = "WAN MEMORY";
export const SITE_DESCRIPTION =
  "愛犬の写真とエピソードから、今を残す思い出動画や虹の橋メモリアルムービーを約1分の実写映画として制作するオーダーメイドサービスです。";
export const DEFAULT_SITE_ORIGIN = "https://kimi-to-no-eiga.ggutae0.chatgpt.site";

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
