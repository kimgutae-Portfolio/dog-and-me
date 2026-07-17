import type { Metadata } from "next";
import { StudioClient } from "./StudioClient";

export const metadata: Metadata = {
  title: "制作室",
  robots: { index: false, follow: false },
};

export default function StudioPage() { return <StudioClient />; }
