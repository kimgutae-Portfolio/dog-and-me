"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const dogs = [
  { src: "/hero-dogs/moka-trot.webp", row: "0%", rows: 3, size: 76, delay: 0 },
  { src: "/hero-dogs/retriever-husky-trot-mobile.webp", row: "0%", rows: 2, size: 94, delay: .6 },
  { src: "/hero-dogs/anzu-trot.webp", row: "0%", rows: 3, size: 70, delay: 1.2 },
  { src: "/hero-dogs/retriever-husky-trot-mobile.webp", row: "100%", rows: 2, size: 92, delay: 1.8 },
  { src: "/hero-dogs/daifuku-trot.webp", row: "0%", rows: 3, size: 72, delay: 2.4 },
];
const seatGap = 8;
const groupWidth = dogs.reduce((total, dog) => total + dog.size, 0) + seatGap * (dogs.length - 1);
const seatOffsets = dogs.map((_, index) => dogs.slice(0, index).reduce((total, dog) => total + dog.size + seatGap, 0) / groupWidth);

export function HeroDogDash({ paused = false, onComplete }: { paused?: boolean; onComplete?: () => void }) {
  // Render the first dog with the initial HTML instead of waiting for hydration.
  const [settled, setSettled] = useState(false);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    // Keep one timeline even when the dogs are temporarily outside the viewport.
    const timer = setTimeout(() => { setSettled(true); onComplete?.(); }, 13300);
    return () => clearTimeout(timer);
  }, [onComplete]);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateVisibility = () => {
      const hidden = paused || motion.matches || window.scrollY > 20;
      setFading(hidden);
      if (hidden) onComplete?.();
    };
    const frame = requestAnimationFrame(updateVisibility);
    window.addEventListener("scroll", updateVisibility, { passive: true });
    motion.addEventListener("change", updateVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateVisibility);
      motion.removeEventListener("change", updateVisibility);
    };
  }, [paused, onComplete]);

  return <div className={`hero-dog-dash${settled ? " is-settled" : ""}${fading ? " is-fading" : ""}`} aria-hidden="true">
    {[...new Set(dogs.map(dog => dog.src))].map((src, index) => <link key={src} rel="preload" as="image" href={src} media="(max-width: 640px)" fetchPriority={index === 0 ? "high" : "auto"} />)}
    {dogs.map((dog, index) => <div key={index} className={`hero-dog-dash-runner${index === 0 ? " dog-first" : ""}${index === 2 ? " dog-stumble" : ""}`} style={{ left: index === 0 ? "10px" : undefined, "--dog-size": `${dog.size}px`, "--dog-seat-width": dog.size / groupWidth, "--dog-seat-offset": seatOffsets[index], "--dog-delay": `${dog.delay}s`, "--dog-index": index, "--dog-row": dog.row, "--dog-sheet-height": `${dog.rows * 100}%`, "--dog-seated-size": dog.rows === 3 ? "400% 300%" : "200% 100%", "--dog-seated-position": dog.rows === 3 ? "66.666% 50%" : index === 1 ? "0% 0%" : "100% 0%" } as CSSProperties}>
      <span className="hero-dog-dust"><i /><i /><i /></span>
      <span className="hero-dog-moving">
      <span className="hero-dog-dash-sprite" style={{ backgroundImage: `url(${dog.src})` }} />
      </span>
      <span className="hero-dog-seated" style={{ backgroundImage: `url(${dog.rows === 3 ? dog.src : "/hero-dogs/retriever-husky-seated.webp"})` }} />
    </div>)}
  </div>;
}
