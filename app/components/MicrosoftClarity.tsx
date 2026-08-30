"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const CLARITY_PROJECT_ID = "y85hni5ik1";
const CLARITY_SCRIPT_SELECTOR = "script[data-wm-clarity]";
const CLARITY_PATHS = new Set([
  "/",
  "/aiken-omoide-douga",
  "/aiken-shashin-douga",
  "/aiken-shashin-seiri",
  "/dog-photo-guide",
  "/film/moka-demo",
  "/uchinoko-kinenbi-douga",
]);

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function isClarityPath(pathname: string) {
  return CLARITY_PATHS.has(normalizePath(pathname));
}

export function MicrosoftClarity() {
  const pathname = usePathname();
  const enabled = isClarityPath(pathname);

  useLayoutEffect(() => {
    const existingScript = document.querySelector(CLARITY_SCRIPT_SELECTOR);

    // Clarity keeps running after a Next.js client navigation even if its tag is
    // removed. Reload before painting a private route so Studio, forms, customer
    // websites, chats, photos, and order URLs never join a recorded session.
    if (!enabled) {
      if (existingScript) window.location.reload();
      return;
    }

    if (existingScript) return;

    const clarityWindow = window as typeof window & {
      clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
    };
    clarityWindow.clarity =
      clarityWindow.clarity ??
      Object.assign(
        (...args: unknown[]) => {
          clarityWindow.clarity?.q?.push(args);
        },
        { q: [] as unknown[][] },
      );

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    script.dataset.wmClarity = "true";
    document.head.appendChild(script);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Keep normal marketing navigation client-side, but cross the boundary into
    // a private/product route with a fresh document before Clarity can observe it.
    const leaveRecordedArea = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download"))
        return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || isClarityPath(url.pathname)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(url.href);
    };

    document.addEventListener("click", leaveRecordedArea, true);
    return () => document.removeEventListener("click", leaveRecordedArea, true);
  }, [enabled]);

  return null;
}
