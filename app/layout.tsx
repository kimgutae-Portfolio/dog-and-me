import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: {
      default: "WAN MEMORY｜愛犬との時間を動く記憶に",
      template: "%s｜WAN MEMORY",
    },
    description:
      "写真とエピソードをもとに、愛犬とのかけがえのない時間を実写映画のような映像に仕立てるオーダーメイドサービスです。",
    openGraph: {
      title: "WAN MEMORY",
      description: "愛犬との時間を、いつまでも動く記憶に。",
      locale: "ja_JP",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "愛犬との時間を、いつまでも動く記憶に。" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "WAN MEMORY",
      description: "愛犬との時間を、いつまでも動く記憶に。",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
