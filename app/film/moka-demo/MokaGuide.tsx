"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @next/next/no-img-element -- Transparent character frames are animation sprites. */

const framePath = "/film/moka/character/frames";
// The frames were cleaned after launch. A revisioned URL prevents browsers and
// the production CDN from reusing an older seated frame with neighbour pixels.
const frameRevision = "20260812-clean-2";
const reactions = ["head-tilt", "paw-wave", "speak-open"] as const;

const messages: Record<string, string[]> = {
  cover: ["ぼくの思い出へ、ようこそ。", "ゆっくり見ていってね。"],
  film: ["五つの思い出が、一つの物語になったよ。", "音も一緒に楽しんでね。"],
  album: ["写真は横にもめくれるよ。", "これは、ぼくの大切な時間。"],
  letter: ["いつもの毎日が、宝物だったんだ。", "最後まで見てくれて、ありがとう。"],
};

type Pose = typeof reactions[number] | "idle" | "sit";

export function MokaGuide() {
  const guideRef = useRef<HTMLDivElement>(null);
  const activeSection = useRef("cover");
  const pausedUntil = useRef(0);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pose, setPose] = useState<Pose>("idle");
  const [message, setMessage] = useState(messages.cover[0]);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [resting, setResting] = useState(false);

  const speak = useCallback((nextPose: Pose = "head-tilt") => {
    const lines = messages[activeSection.current];
    pausedUntil.current = performance.now() + 3400;
    setMessage(lines[Math.floor(Math.random() * lines.length)]);
    setBubbleVisible(true);
    setPose(nextPose);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => {
      setBubbleVisible(false);
      setPose("idle");
    }, 3200);
  }, []);

  useEffect(() => {
    const sections = [
      ["cover", document.querySelector(".moka-cover")],
      ["film", document.querySelector("#complete-film")],
      ["album", document.querySelector("#moka-album")],
      ["letter", document.querySelector("#moka-letter")],
    ] as const;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const match = sections.find(([, element]) => element === visible?.target);
      if (!match || activeSection.current === match[0]) return;
      activeSection.current = match[0];
    }, { threshold: [0.25, 0.5, 0.7], rootMargin: "-10% 0px -18%" });
    sections.forEach(([, element]) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (resting) return;
    const guide = guideRef.current;
    if (!guide) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      guide.style.transform = "translate3d(20px,0,0)";
      return;
    }

    let x = Math.min(window.innerWidth * 0.7, window.innerWidth - 230);
    let direction = -1;
    let previous = performance.now();
    let animationId = 0;
    const move = (now: number) => {
      const delta = Math.min(now - previous, 34);
      previous = now;
      if (now >= pausedUntil.current) {
        guide.dataset.moving = "true";
        const characterWidth = window.innerWidth <= 640 ? 126 : 174;
        const minX = window.innerWidth <= 640 ? 4 : 20;
        const maxX = Math.max(minX, window.innerWidth - characterWidth - minX);
        x += direction * delta * (window.innerWidth <= 640 ? 0.025 : 0.04);
        if (x <= minX || x >= maxX) {
          x = Math.max(minX, Math.min(maxX, x));
          direction *= -1;
        }
        guide.style.transform = `translate3d(${x}px,0,0) scaleX(${direction > 0 ? 1 : -1})`;
        guide.dataset.direction = direction > 0 ? "right" : "left";
      } else {
        guide.dataset.moving = "false";
      }
      animationId = requestAnimationFrame(move);
    };
    animationId = requestAnimationFrame(move);
    return () => cancelAnimationFrame(animationId);
  }, [resting]);

  useEffect(() => {
    const hideWhileReading = () => {
      setBubbleVisible(false);
      setPose("idle");
      pausedUntil.current = 0;
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
    };
    window.addEventListener("scroll", hideWhileReading, { passive: true });
    return () => {
      window.removeEventListener("scroll", hideWhileReading);
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
    };
  }, []);

  if (resting) {
    return <button className="moka-guide-wake" type="button" onClick={() => setResting(false)}>モカを呼ぶ <span aria-hidden="true">♡</span></button>;
  }

  return (
    <aside className="moka-guide-layer" aria-label="ページを案内するモカ">
      <div className="moka-guide" ref={guideRef} data-direction="left">
        <div className={bubbleVisible ? "moka-guide-bubble is-visible" : "moka-guide-bubble"} role="status" aria-live="polite">
          <span>{message}</span>
          <button type="button" onClick={() => setResting(true)} aria-label="モカを休ませる">×</button>
        </div>
        <button className="moka-guide-character" type="button" onClick={() => speak(reactions[Math.floor(Math.random() * reactions.length)])} aria-label="モカに話しかける">
          <span className="moka-guide-walk-sprite" aria-hidden="true" />
          <img
            className="moka-guide-pose"
            src={`${framePath}/${pose}.png?v=${frameRevision}`}
            alt=""
            draggable={false}
          />
        </button>
      </div>
    </aside>
  );
}
