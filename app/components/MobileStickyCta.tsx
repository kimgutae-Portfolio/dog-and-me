"use client";

import { useEffect, useState } from "react";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { APPLICATIONS_OPEN, PRELAUNCH_CTA } from "../lib/site";
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
    <aside
      className={visible ? "mobile-sticky-cta visible" : "mobile-sticky-cta"}
      aria-label="お申し込み"
    >
      <div>
        <p>
          {APPLICATIONS_OPEN
            ? `MONITOR PRICE · 物語案の確認までは無料`
            : "COMING SOON"}
        </p>
        <strong>
          {APPLICATIONS_OPEN ? (
            <>
              ¥{formatYen(MEMORY_FILM_PRICING.launchPrice)}
              <span>（税込）</span>
            </>
          ) : (
            PRELAUNCH_CTA
          )}
        </strong>
      </div>
      {/* The price sits right beside this button, so the label stays a plain
          action — "無料で始める" read as a contradiction next to ¥19,800. What is
          free (everything up to seeing the proposals) is stated in the line above. */}
      <StartStoryLink className="button button-cream">
        物語をつくる <span aria-hidden="true">→</span>
      </StartStoryLink>
    </aside>
  );
}
