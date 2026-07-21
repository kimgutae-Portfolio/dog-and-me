"use client";

import { useEffect } from "react";

export function MemoryMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".memory-demo-page");
    if (!root) return;

    root.classList.add("memory-motion-ready");
    const loadFrame = window.requestAnimationFrame(() => root.classList.add("memory-loaded"));
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-memory-reveal]"));
    const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-memory-page]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileViewport = window.matchMedia("(max-width: 760px)");
    let pageMotionFrame: number | null = null;

    const updatePageMotion = () => {
      pageMotionFrame = null;
      if (reducedMotion.matches) return;

      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const mobile = mobileViewport.matches;
      const rotateAmount = mobile ? 2.2 : 3.6;
      const shiftAmount = mobile ? 16 : 28;

      pages.forEach((page) => {
        const rect = page.getBoundingClientRect();
        const incoming = Math.min(1, Math.max(0, (viewportHeight - rect.top) / (viewportHeight * 0.52)));
        const outgoing = Math.min(1, Math.max(0, (viewportHeight * 0.46 - rect.bottom) / (viewportHeight * 0.46)));
        const fold = Math.max(1 - incoming, outgoing);
        const rotate = (1 - incoming) * rotateAmount - outgoing * rotateAmount;
        const shift = (1 - incoming) * shiftAmount - outgoing * shiftAmount * 0.7;
        const scale = 1 - fold * (mobile ? 0.006 : 0.01);

        page.style.setProperty("--memory-page-rotate", `${rotate.toFixed(3)}deg`);
        page.style.setProperty("--memory-page-shift", `${shift.toFixed(2)}px`);
        page.style.setProperty("--memory-page-scale", scale.toFixed(4));
        page.style.setProperty("--memory-page-fold", (fold * (mobile ? 0.32 : 0.42)).toFixed(3));
        page.style.transformOrigin = outgoing > 0 ? "50% 100%" : "50% 0%";
      });
    };

    const requestPageMotion = () => {
      if (pageMotionFrame !== null) return;
      pageMotionFrame = window.requestAnimationFrame(updatePageMotion);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

    targets.forEach((target) => observer.observe(target));
    updatePageMotion();
    window.addEventListener("scroll", requestPageMotion, { passive: true });
    window.addEventListener("resize", requestPageMotion);
    window.visualViewport?.addEventListener("resize", requestPageMotion);

    return () => {
      window.cancelAnimationFrame(loadFrame);
      if (pageMotionFrame !== null) window.cancelAnimationFrame(pageMotionFrame);
      observer.disconnect();
      window.removeEventListener("scroll", requestPageMotion);
      window.removeEventListener("resize", requestPageMotion);
      window.visualViewport?.removeEventListener("resize", requestPageMotion);
      pages.forEach((page) => {
        page.style.removeProperty("--memory-page-rotate");
        page.style.removeProperty("--memory-page-shift");
        page.style.removeProperty("--memory-page-scale");
        page.style.removeProperty("--memory-page-fold");
        page.style.removeProperty("transform-origin");
      });
      root.classList.remove("memory-motion-ready", "memory-loaded");
    };
  }, []);

  return (
    <div className="memory-atmosphere" aria-hidden="true">
      <span className="memory-light-leak" />
      <span className="memory-film-grain" />
      <span className="memory-dust dust-1" />
      <span className="memory-dust dust-2" />
      <span className="memory-dust dust-3" />
      <span className="memory-dust dust-4" />
      <span className="memory-dust dust-5" />
    </div>
  );
}
