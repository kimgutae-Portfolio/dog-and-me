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
            ? "お名前 → 登録 → 写真と思い出を入力"
            : "COMING SOON"}
        </p>
        <strong>
          {APPLICATIONS_OPEN ? (
            <>
              ¥{formatYen(MEMORY_FILM_PRICING.price)}
              <span>（税込）</span>
            </>
          ) : (
            PRELAUNCH_CTA
          )}
        </strong>
      </div>
      {/* The price stays explicit; the action starts a consultation, not a paid
          order or an instantly generated sample. The next steps are shown above. */}
      <StartStoryLink className="button button-cream" ctaLocation="mobile_sticky">
        制作相談を始める <span aria-hidden="true">→</span>
      </StartStoryLink>
    </aside>
  );
}
