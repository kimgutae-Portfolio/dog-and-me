import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "専用ものがたりサイト",
  robots: { index: false, follow: false },
};

// orderId is looked up as an orders.id UUID, so anything else can never resolve
// to a real page. Without this guard the dynamic segment swallows every unknown
// /film/* URL and answers 200 with a loading screen — a soft 404 that keeps
// retired URLs (the old demo pages) alive in search results.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerFilmPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!UUID_PATTERN.test(orderId)) notFound();

  redirect(`/studio?order=${encodeURIComponent(orderId)}`);
}
