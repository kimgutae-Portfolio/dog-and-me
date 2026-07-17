import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioClient } from "./StudioClient";

export const metadata: Metadata = {
  title: "制作室",
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <Suspense fallback={<div className="wizard-loading">制作室を準備しています…</div>}><StudioClient /></Suspense>;
}
