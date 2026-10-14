"use client";

import { useEffect, useRef } from "react";

/** A decorative mobile companion; never intercepts scrolling or taps. */
export function ScrollHangingDog() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 640px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let previousY = window.scrollY;
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const node = root.current;
      if (node) {
        node.classList.toggle("is-visible", mobile.matches && y > 100);
        const sway = reduced.matches ? 0 : Math.max(-9, Math.min(9, (y - previousY) * .16));
        node.style.setProperty("--hanging-dog-sway", `${sway}deg`);
        node.style.setProperty("--hanging-dog-drop", `${reduced.matches ? 0 : Math.min(5, Math.abs(sway) * .5)}px`);
      }
      previousY = y;
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => {
        root.current?.style.setProperty("--hanging-dog-sway", "0deg");
        root.current?.style.setProperty("--hanging-dog-drop", "0px");
      }, 160);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    mobile.addEventListener("change", schedule);
    reduced.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      if (settle) clearTimeout(settle);
      window.removeEventListener("scroll", schedule);
      mobile.removeEventListener("change", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, []);

  return <div ref={root} className="scroll-hanging-dog" aria-hidden="true">
    <svg viewBox="0 0 72 134" fill="none" focusable="false">
      <path d="M36 0V18" stroke="#ab8c70" strokeWidth="2" />
      <path d="M13 20H59" stroke="#ab8c70" strokeWidth="4" strokeLinecap="round" />
      <g className="scroll-hanging-dog-body" stroke="#9c6d48" strokeWidth="1.1" strokeLinejoin="round">
        <path d="M54 85C71 79 68 99 53 101" fill="#dba574" />
        <path d="M24 70C16 86 21 110 25 121C27 128 35 125 35 119L37 104L39 119C40 125 48 128 51 120C55 108 58 85 48 70Z" fill="#e9bb8a" />
        <ellipse cx="37" cy="94" rx="11" ry="17" fill="#fff0d9" stroke="none" />
        <path d="M24 77C15 64 13 47 17 25L24 24L30 67M48 77C58 64 59 47 55 25L48 24L43 67" fill="#e9bb8a" />
        <path d="M21 40C10 32 4 47 9 66C12 75 20 73 24 65M51 40C63 32 69 47 64 66C61 75 53 73 49 65" fill="#c78d5f" />
        <path d="M18 45C16 37 21 32 27 34C31 27 40 29 43 33C50 31 56 37 55 44C61 50 59 65 53 71C45 81 28 81 20 72C13 65 12 51 18 45Z" fill="#f0c899" />
        <ellipse cx="27" cy="54" rx="3.3" ry="4.2" fill="#362b27" stroke="none" />
        <ellipse cx="46" cy="54" rx="3.3" ry="4.2" fill="#362b27" stroke="none" />
        <circle cx="26" cy="52.7" r="1" fill="white" stroke="none" />
        <circle cx="45" cy="52.7" r="1" fill="white" stroke="none" />
        <ellipse cx="36.5" cy="65" rx="12" ry="8" fill="#fff0d9" stroke="none" />
        <path d="M32 61C32 57 41 57 41 61C40 66 34 66 32 61Z" fill="#49352c" stroke="none" />
        <path d="M36.5 65V68M32 68Q36.5 73 41 68" strokeLinecap="round" />
        <path d="M24 78Q36 83 49 78" stroke="#9a6265" strokeWidth="4" />
        <circle cx="37" cy="82" r="3" fill="#d8b46b" stroke="none" />
        <path d="M12 25C10 17 15 13 21 16C27 12 30 17 27 24C24 30 16 31 12 25ZM45 24C42 17 46 12 52 16C59 13 63 17 60 25C56 31 48 30 45 24Z" fill="#f4d2a8" />
        <path d="M17 20V25M22 20V25M50 20V25M55 20V25" stroke="#bb885e" strokeLinecap="round" />
      </g>
    </svg>
  </div>;
}
