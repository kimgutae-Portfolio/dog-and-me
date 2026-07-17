import type { Metadata } from "next";
import { SharedMemorySite } from "./SharedMemorySite";

export const metadata: Metadata = {
  title: "家族専用メモリーサイト",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SharedMemoryPage() {
  return <SharedMemorySite />;
}

