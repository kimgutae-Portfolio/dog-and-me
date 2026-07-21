import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AuthProvider } from "./components/AuthProvider";
import { SITE_DESCRIPTION, SITE_NAME } from "./lib/site";
import { getRequestOrigin } from "./lib/site-server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();

  return {
    metadataBase: new URL(origin),
    applicationName: SITE_NAME,
    title: {
      default: "愛犬の思い出動画・メモリアルムービー制作｜WAN MEMORY",
      template: `%s｜${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    authors: [{ name: SITE_NAME, url: origin }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "ペット・映像制作",
    referrer: "origin-when-cross-origin",
    formatDetection: { email: false, address: false, telephone: false },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: "愛犬の思い出動画・メモリアルムービー制作｜WAN MEMORY",
      description: SITE_DESCRIPTION,
      url: origin,
      siteName: SITE_NAME,
      locale: "ja_JP",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "愛犬との時間を、いつまでも動く記憶に。" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "愛犬の思い出動画・メモリアルムービー制作｜WAN MEMORY",
      description: SITE_DESCRIPTION,
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#303a31",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
