import type { Metadata } from "next";
import { getRequestOrigin } from "../../lib/site-server";
import { getPublicSharedMemoryBySlug } from "../../lib/supabase/public-memory";
import { SharedMemorySite } from "../../memory/[shareId]/SharedMemorySite";

type PageProps = {
  params: Promise<{ customerSlug: string; petSlug: string }>;
};

function decodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const routeParams = await params;
  const customerSlug = decodeRouteSegment(routeParams.customerSlug);
  const petSlug = decodeRouteSegment(routeParams.petSlug);
  const [origin, memory] = await Promise.all([
    getRequestOrigin(),
    getPublicSharedMemoryBySlug(customerSlug, petSlug).catch(() => null),
  ]);
  const title = memory
    ? `${memory.order.pet_name}の動く絵本「${memory.delivery.title}」`
    : "専用ものがたりサイト";
  const description = memory
    ? `${memory.order.pet_name}との大切な時間から描いた、WAN MEMORYの動く絵本です。`
    : "愛犬との大切な時間を、動く絵本と写真で見返せるWAN MEMORYの専用ページです。";
  const pageUrl = `${origin}/${encodeURIComponent(customerSlug)}/${encodeURIComponent(petSlug)}`;

  return {
    title,
    description,
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
    referrer: "no-referrer",
    openGraph: { title, description, url: pageUrl, siteName: "WAN MEMORY", locale: "ja_JP", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PersonalMemoryPage({ params }: PageProps) {
  const routeParams = await params;
  const customerSlug = decodeRouteSegment(routeParams.customerSlug);
  const petSlug = decodeRouteSegment(routeParams.petSlug);
  const initialMemory = await getPublicSharedMemoryBySlug(
    customerSlug,
    petSlug,
  ).catch(() => null);
  return (
    <SharedMemorySite
      customerSlug={customerSlug}
      petSlug={petSlug}
      initialMemory={initialMemory}
    />
  );
}
