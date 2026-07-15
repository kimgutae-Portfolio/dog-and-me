"use client";

import { useEffect } from "react";

export function MemoryMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".memory-demo-page");
    if (!root) return;

    root.classList.add("memory-motion-ready");
    const loadFrame = window.requestAnimationFrame(() => root.classList.add("memory-loaded"));
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-memory-reveal]"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

    targets.forEach((target) => observer.observe(target));

    return () => {
      window.cancelAnimationFrame(loadFrame);
      observer.disconnect();
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
