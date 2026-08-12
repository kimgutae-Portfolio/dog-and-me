"use client";

import { useEffect } from "react";

const revealSelectors = [
  ".storybook-heading > *",
  ".storybook-intro-grid > *",
  ".storybook-film-frame",
  ".storybook-memory-track > li",
  ".storybook-personal-site-heading > *",
  ".storybook-site-window",
  ".storybook-personal-site-copy > *",
  ".storybook-personal-site-features > li",
  ".storybook-method-summary > *",
  ".storybook-directions .section-heading-row > *",
  ".process-section > .shell > *",
  ".process-list > li",
  ".pricing-heading > *",
  ".pricing-grid > *",
  ".faq-grid > *",
  ".faq-list > details",
  ".storybook-final-cta .final-cta-inner > *",
].join(",");

export function HomeStoryMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".storybook-home");
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const revealItems = Array.from(root.querySelectorAll<HTMLElement>(revealSelectors));
    const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));

    revealItems.forEach((item, index) => {
      item.dataset.storyReveal = "";
      item.style.setProperty("--story-delay", `${Math.min(index % 5, 4) * 90}ms`);
    });
    root.classList.add("storybook-motion-ready");

    if (reducedMotion.matches) {
      revealItems.forEach((item) => item.classList.add("is-story-visible"));
      return () => root.classList.remove("storybook-motion-ready");
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).classList.add("is-story-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10%", threshold: 0.12 },
    );
    revealItems.forEach((item) => revealObserver.observe(item));

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-section-active", entry.isIntersecting);
        });
      },
      { rootMargin: "-24% 0px -24%", threshold: 0.08 },
    );
    sections.forEach((section) => sectionObserver.observe(section));

    let frame = 0;
    const updateDepth = () => {
      frame = 0;
      const viewport = window.innerHeight || 1;
      sections.forEach((section) => {
        const bounds = section.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (viewport / 2 - (bounds.top + bounds.height / 2)) / viewport));
        section.style.setProperty("--section-drift", `${progress * 22}px`);
      });
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateDepth);
    };
    updateDepth();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      revealObserver.disconnect();
      sectionObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      root.classList.remove("storybook-motion-ready");
    };
  }, []);

  return null;
}
