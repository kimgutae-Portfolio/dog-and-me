function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const publicUrls = [
    origin,
    `${origin}/aiken-omoide-douga`,
    `${origin}/uchinoko-kinenbi-douga`,
    `${origin}/dog-photo-guide`,
    `${origin}/film/momo-demo`,
    `${origin}/contact`,
    `${origin}/terms`,
    `${origin}/privacy`,
    `${origin}/legal`,
  ];
  const entries = publicUrls
    .map((url) => `<url><loc>${escapeXml(url)}</loc></url>`)
    .join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
