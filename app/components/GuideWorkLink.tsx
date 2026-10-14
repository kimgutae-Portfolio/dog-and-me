"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackEvent } from "../lib/analytics";

export function GuideWorkLink({ children, className, location }: { children: ReactNode; className?: string; location: string }) {
  return <Link href="/film/moka-demo" className={className} onClick={() => {
    trackEvent("guide_work_click", {
      page_path: window.location.pathname,
      cta_location: location,
      destination: "/film/moka-demo",
    });
  }}>{children}</Link>;
}
