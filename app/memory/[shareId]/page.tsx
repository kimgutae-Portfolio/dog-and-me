import type { Metadata } from "next";
import { getRequestOrigin } from "../../lib/site-server";
import { getPublicSharedMemory } from "../../lib/supabase/public-memory";
import { SharedMemorySite } from "./SharedMemorySite";

type PageProps = { params: Promise<{ shareId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareId } = await params;
  const [origin, memory] = await Promise.all([
    getRequestOrigin(),
    getPublicSharedMemory(shareId).catch(() => null),
  ]);
  const title = memory
    ? `${memory.order.pet_name}との思い出「${memory.delivery.title}」`
    : "専用メモリーサイト";
  const description = memory
    ? `${memory.order.pet_name}との大切な時間をまとめた、WAN MEMORYの専用メモリーサイトです。`
    : "大切な時間を、映像と写真でいつでも見返せるWAN MEMORYの専用ページです。";
  const pageUrl = `${origin}/memory/${encodeURIComponent(shareId)}`;
  const imageUrl = `${origin}/api/memory/${encodeURIComponent(shareId)}/og`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
    referrer: "no-referrer",
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "WAN MEMORY",
      locale: "ja_JP",
      type: "website",
      images: [{ url: imageUrl, alt: memory ? `${memory.order.pet_name}の思い出写真` : "WAN MEMORY" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function SharedMemoryPage() {
  return <SharedMemorySite />;
}
