"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { START_STORY_HREF } from "../lib/site";

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
      <div><p>先着10組</p><strong>¥{formatYen(MEMORY_FILM_PRICING.launchPrice)} <span>税込</span></strong></div>
      <Link className="button button-cream" href={START_STORY_HREF}>申し込む <span aria-hidden="true">→</span></Link>
    </aside>
  );
}
