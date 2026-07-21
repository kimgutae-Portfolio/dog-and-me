"use client";

import { useCallback, useEffect, useState } from "react";

const pageLabels = ["表紙", "映像", "記憶", "物語", "写真", "手紙"] as const;

export function MemoryMotion() {
  const [activePage, setActivePage] = useState(0);

  const moveToPage = useCallback((index: number) => {
    const book = document.querySelector<HTMLElement>("[data-memory-book]");
    if (!book) return;
    const safeIndex = Math.min(pageLabels.length - 1, Math.max(0, index));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    book.scrollTo({ left: safeIndex * book.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".memory-demo-page");
    const book = root?.querySelector<HTMLElement>("[data-memory-book]");
    if (!root || !book) return;

    root.classList.add("memory-motion-ready");
    const loadFrame = window.requestAnimationFrame(() => root.classList.add("memory-loaded"));
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-memory-reveal]"));
    const pages = Array.from(book.querySelectorAll<HTMLElement>("[data-memory-page]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileViewport = window.matchMedia("(max-width: 760px)");
    let pageMotionFrame: number | null = null;
    let wheelUnlockTimer: number | undefined;
    let wheelLocked = false;

    const updatePageMotion = () => {
      pageMotionFrame = null;
      const pageWidth = Math.max(book.clientWidth, 1);
      const nextActivePage = Math.min(pages.length - 1, Math.max(0, Math.round(book.scrollLeft / pageWidth)));
      setActivePage(nextActivePage);
      if (reducedMotion.matches) return;

      const rotateAmount = mobileViewport.matches ? 4.2 : 6.4;
      pages.forEach((page) => {
        const offset = Math.min(1, Math.max(-1, (page.offsetLeft - book.scrollLeft) / pageWidth));
        const fold = Math.abs(offset);
        const scale = 1 - fold * (mobileViewport.matches ? 0.008 : 0.012);

        page.style.setProperty("--memory-page-rotate-y", `${(offset * rotateAmount).toFixed(3)}deg`);
        page.style.setProperty("--memory-page-shift-x", "0px");
        page.style.setProperty("--memory-page-scale", scale.toFixed(4));
        page.style.setProperty("--memory-page-fold", (fold * (mobileViewport.matches ? 0.3 : 0.4)).toFixed(3));
        page.style.transformOrigin = offset < 0 ? "0% 50%" : "100% 50%";
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
    }, { root: book, threshold: 0.14, rootMargin: "0px -8% 0px 0px" });

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || Math.abs(event.deltaY) < 8) return;
      const pageWidth = Math.max(book.clientWidth, 1);
      const currentIndex = Math.min(pages.length - 1, Math.max(0, Math.round(book.scrollLeft / pageWidth)));
      const currentPage = pages[currentIndex];
      if (!currentPage) return;

      const direction = event.deltaY > 0 ? 1 : -1;
      const canScrollDown = currentPage.scrollTop + currentPage.clientHeight < currentPage.scrollHeight - 2;
      const canScrollUp = currentPage.scrollTop > 2;
      if ((direction > 0 && canScrollDown) || (direction < 0 && canScrollUp)) return;

      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= pages.length) return;
      event.preventDefault();
      if (wheelLocked) return;

      wheelLocked = true;
      moveToPage(nextIndex);
      window.clearTimeout(wheelUnlockTimer);
      wheelUnlockTimer = window.setTimeout(() => { wheelLocked = false; }, 650);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      moveToPage(Math.round(book.scrollLeft / Math.max(book.clientWidth, 1)) + direction);
    };

    targets.forEach((target) => observer.observe(target));
    updatePageMotion();
    book.addEventListener("scroll", requestPageMotion, { passive: true });
    book.addEventListener("wheel", handleWheel, { passive: false });
    book.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", requestPageMotion);
    window.visualViewport?.addEventListener("resize", requestPageMotion);

    return () => {
      window.cancelAnimationFrame(loadFrame);
      if (pageMotionFrame !== null) window.cancelAnimationFrame(pageMotionFrame);
      window.clearTimeout(wheelUnlockTimer);
      observer.disconnect();
      book.removeEventListener("scroll", requestPageMotion);
      book.removeEventListener("wheel", handleWheel);
      book.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", requestPageMotion);
      window.visualViewport?.removeEventListener("resize", requestPageMotion);
      pages.forEach((page) => {
        page.style.removeProperty("--memory-page-rotate-y");
        page.style.removeProperty("--memory-page-shift-x");
        page.style.removeProperty("--memory-page-scale");
        page.style.removeProperty("--memory-page-fold");
        page.style.removeProperty("transform-origin");
      });
      root.classList.remove("memory-motion-ready", "memory-loaded");
    };
  }, [moveToPage]);

  return (
    <>
      <div className="memory-atmosphere" aria-hidden="true">
        <span className="memory-light-leak" />
        <span className="memory-film-grain" />
        <span className="memory-dust dust-1" />
        <span className="memory-dust dust-2" />
        <span className="memory-dust dust-3" />
        <span className="memory-dust dust-4" />
        <span className="memory-dust dust-5" />
      </div>
      <nav className="memory-book-progress" aria-label="ストーリーページ">
        <span>{String(activePage + 1).padStart(2, "0")} / {String(pageLabels.length).padStart(2, "0")}</span>
        <div>{pageLabels.map((label, index) => <button key={label} type="button" className={activePage === index ? "active" : ""} onClick={() => moveToPage(index)} aria-label={`${label}のページへ`} aria-current={activePage === index ? "page" : undefined} />)}</div>
        <small>{activePage === pageLabels.length - 1 ? "END" : "SWIPE →"}</small>
      </nav>
    </>
  );
}
