"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    <aside className={visible ? "mobile-sticky-cta visible" : "mobile-sticky-cta"} aria-label="サービス公開状況">
      <div><p>PREPARING FOR LAUNCH</p><strong>現在、正式公開準備中</strong></div>
      <Link className="button button-cream" href="/film/momo-demo">完成デモ <span aria-hidden="true">→</span></Link>
    </aside>
  );
}
