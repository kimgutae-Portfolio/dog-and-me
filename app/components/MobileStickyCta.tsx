"use client";

import { useEffect, useState } from "react";
import { StartStoryLink } from "./StartStoryLink";

export function MobileStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const finalSection = document.querySelector(".final-cta");
    const update = () => {
      const scrolledPastHero = window.scrollY > window.innerHeight * 0.72;
      const finalSectionVisible = finalSection
        ? finalSection.getBoundingClientRect().top < window.innerHeight * 0.9
        : false;
      setVisible(scrolledPastHero && !finalSectionVisible);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <aside className={visible ? "mobile-sticky-cta visible" : "mobile-sticky-cta"} aria-label="お申し込み">
      <div><p>MEMORY FILM</p><strong>先着10組 モニター受付中</strong></div>
      <StartStoryLink className="button button-cream">思い出をつくる <span aria-hidden="true">→</span></StartStoryLink>
    </aside>
  );
}
