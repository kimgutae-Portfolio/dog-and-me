"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  APPLICATIONS_OPEN,
  PRELAUNCH_CTA,
  START_STORY_HREF,
} from "../lib/site";
import { useAuth } from "./AuthProvider";
import { trackEvent } from "../lib/analytics";
import type { MemoryPlanId } from "../lib/pricing";

type StartStoryLinkProps = {
  children: ReactNode;
  className?: string;
  ctaLocation?: string;
  planId?: MemoryPlanId;
};

export function StartStoryLink({ children, className, ctaLocation = "unspecified", planId }: StartStoryLinkProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [queued, setQueued] = useState(false);
  const baseHref = user ? "/story" : START_STORY_HREF;
  const href = planId ? `${baseHref}?plan=${planId}` : baseHref;

  useEffect(() => {
    if (!queued || loading) return;
    router.push(href);
  }, [href, loading, queued, router]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    trackEvent("start_story_click", {
      cta_location: ctaLocation,
      destination: href,
      signed_in: Boolean(user),
      page_path: window.location.pathname,
      ...(planId ? { plan_id: planId } : {}),
    });
    if (!loading) return;
    event.preventDefault();
    setQueued(true);
  };

  if (!APPLICATIONS_OPEN) {
    return (
      <span
        className={[className, "button-prelaunch"].filter(Boolean).join(" ")}
        aria-disabled="true"
      >
        {PRELAUNCH_CTA}
      </span>
    );
  }

  return (
    <Link className={className} href={href} onClick={handleClick} aria-busy={queued || undefined}>
      {children}
    </Link>
  );
}
