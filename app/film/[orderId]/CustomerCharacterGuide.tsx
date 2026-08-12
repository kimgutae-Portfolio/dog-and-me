"use client";

import { useEffect, useRef, useState } from "react";

const messages = [
  "ぼくの物語へ、ようこそ。",
  "ゆっくり見ていってね。",
  "大切な思い出が、ここにあるよ。",
];

export function CustomerCharacterGuide({ spriteUrl, petName }: { spriteUrl: string; petName: string }) {
  const guideRef = useRef<HTMLButtonElement>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const guide = guideRef.current;
    if (!guide || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let x = Math.min(window.innerWidth * .68, window.innerWidth - 190);
    let direction = -1;
    let previous = performance.now();
    let id = 0;
    const move = (now: number) => {
      const delta = Math.min(now - previous, 34);
      previous = now;
      const size = window.innerWidth <= 640 ? 116 : 156;
      const edge = window.innerWidth <= 640 ? 4 : 18;
      x += direction * delta * (window.innerWidth <= 640 ? .022 : .034);
      if (x <= edge || x >= window.innerWidth - size - edge) {
        x = Math.max(edge, Math.min(window.innerWidth - size - edge, x));
        direction *= -1;
      }
      guide.style.transform = `translate3d(${x}px,0,0) scaleX(${direction > 0 ? 1 : -1})`;
      guide.dataset.direction = direction > 0 ? "right" : "left";
      id = requestAnimationFrame(move);
    };
    id = requestAnimationFrame(move);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const hideWhileReading = () => {
      setSpeaking(false);
      if (speechTimer.current) clearTimeout(speechTimer.current);
    };
    window.addEventListener("scroll", hideWhileReading, { passive: true });
    return () => {
      window.removeEventListener("scroll", hideWhileReading);
      if (speechTimer.current) clearTimeout(speechTimer.current);
    };
  }, []);

  return (
    <aside className="customer-character-layer" aria-label={`${petName}のキャラクター案内`}>
      <button
        ref={guideRef}
        className="customer-character"
        type="button"
        data-direction="left"
        onClick={() => {
          setMessageIndex((current) => (current + 1) % messages.length);
          setSpeaking(true);
          if (speechTimer.current) clearTimeout(speechTimer.current);
          speechTimer.current = setTimeout(() => setSpeaking(false), 3200);
        }}
        aria-label={`${petName}に話しかける`}
      >
        <span className={speaking ? "customer-character-bubble is-visible" : "customer-character-bubble"}>{messages[messageIndex]}</span>
        <span className="customer-character-sprite" style={{ backgroundImage: `url(${spriteUrl})` }} aria-hidden="true" />
      </button>
    </aside>
  );
}
