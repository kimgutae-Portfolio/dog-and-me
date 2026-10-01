/** Only allow paths on this site, including after URL normalization. */
export function safeAuthNext(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/studio";
  try {
    const url = new URL(value, "https://wanmemory.invalid");
    return url.origin === "https://wanmemory.invalid" ? `${url.pathname}${url.search}${url.hash}` : "/studio";
  } catch {
    return "/studio";
  }
}
