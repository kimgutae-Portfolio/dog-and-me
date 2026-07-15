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
      default: "きみとの映画｜愛犬との時間を一本の映画に",
      template: "%s｜きみとの映画",
    },
    description:
      "写真とエピソードをもとに、愛犬とのかけがえのない時間を実写映画のような映像に仕立てるオーダーメイドサービスです。",
    openGraph: {
      title: "きみとの映画",
      description: "一緒に過ごした時間を、一本の映画に。",
      locale: "ja_JP",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "愛犬と歩く時間を一本の映画に" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "きみとの映画",
      description: "一緒に過ごした時間を、一本の映画に。",
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
