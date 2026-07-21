import { getPublicMemoryHeroUrl, getPublicSharedMemory } from "../../../../lib/supabase/public-memory";

type RouteContext = { params: Promise<{ token: string }> };

function fallbackImage(request: Request) {
  return Response.redirect(new URL("/og.png", request.url), 307);
}

export async function GET(request: Request, { params }: RouteContext) {
  const { token } = await params;
  const memory = await getPublicSharedMemory(token).catch(() => null);
  if (!memory) return fallbackImage(request);

  const signedUrl = await getPublicMemoryHeroUrl(memory).catch(() => null);
  if (!signedUrl) return fallbackImage(request);

  const image = await fetch(signedUrl, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
  const contentType = image?.headers.get("content-type") ?? "";
  if (!image?.ok || !contentType.startsWith("image/")) return fallbackImage(request);

  return new Response(await image.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noimageindex",
    },
  });
}
