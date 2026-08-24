"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const messages = [
  "ぼくの物語へ、ようこそ。",
  "ゆっくり見ていってね。",
  "大切な思い出が、ここにあるよ。",
];

const poseSequence = ["sit", "tilt", "happy", "wave", "rest", "idle"] as const;
type CharacterActivity = "walk" | "speak" | typeof poseSequence[number];

export function CustomerCharacterGuide({ spriteUrl, petName }: { spriteUrl: string; petName: string }) {
  const guideRef = useRef<HTMLButtonElement>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poseCursor = useRef(0);
  const activityRef = useRef<CharacterActivity>("walk");
  const [messageIndex, setMessageIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [activity, setActivity] = useState<CharacterActivity>("walk");

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  const showSpeech = useCallback(() => {
    setMessageIndex((current) => (current + 1) % messages.length);
    setSpeaking(true);
    setActivity("speak");
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = setTimeout(() => {
      setSpeaking(false);
      setActivity("walk");
    }, 3200);
  }, []);

  useEffect(() => {
    const guide = guideRef.current;
    if (!guide) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      guide.style.transform = "translate3d(18px,0,0)";
      setActivity("idle");
      return;
    }
    let x = Math.min(window.innerWidth * .68, window.innerWidth - 190);
    let direction = -1;
    let previous = performance.now();
    let id = 0;
    const move = (now: number) => {
      const delta = Math.min(now - previous, 34);
      previous = now;
      const size = window.innerWidth <= 640 ? 116 : 156;
      const edge = window.innerWidth <= 640 ? 4 : 18;
      if (activityRef.current === "walk") {
        x += direction * delta * (window.innerWidth <= 640 ? .022 : .034);
        if (x <= edge || x >= window.innerWidth - size - edge) {
          x = Math.max(edge, Math.min(window.innerWidth - size - edge, x));
          direction *= -1;
        }
        guide.style.transform = `translate3d(${x}px,0,0) scaleX(${direction > 0 ? 1 : -1})`;
        guide.dataset.direction = direction > 0 ? "right" : "left";
      }
      id = requestAnimationFrame(move);
    };
    id = requestAnimationFrame(move);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || activity === "speak") return;
    const delay = activity === "walk" ? 6200 : activity === "rest" ? 4200 : 2800;
    const timer = window.setTimeout(() => {
      if (activity === "walk") {
        const nextPose = poseSequence[poseCursor.current % poseSequence.length];
        poseCursor.current += 1;
        setActivity(nextPose);
      } else {
        setActivity("walk");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activity]);

  useEffect(() => {
    let lastScrollAt = performance.now();
    const hideWhileReading = () => {
      lastScrollAt = performance.now();
      setSpeaking(false);
      setActivity("walk");
      if (speechTimer.current) clearTimeout(speechTimer.current);
    };
    const occasionalSpeech = window.setInterval(() => {
      if (document.hidden || performance.now() - lastScrollAt < 6000) return;
      showSpeech();
    }, 18000);
    window.addEventListener("scroll", hideWhileReading, { passive: true });
    return () => {
      window.clearInterval(occasionalSpeech);
      window.removeEventListener("scroll", hideWhileReading);
      if (speechTimer.current) clearTimeout(speechTimer.current);
    };
  }, [showSpeech]);

  return (
    <aside className="customer-character-layer" aria-label={`${petName}のキャラクター案内`}>
      <button
        ref={guideRef}
        className="customer-character"
        type="button"
        data-direction="left"
        data-activity={activity}
        onClick={showSpeech}
        aria-label={`${petName}に話しかける`}
      >
        <span className={speaking ? "customer-character-bubble is-visible" : "customer-character-bubble"}>{messages[messageIndex]}</span>
        <span className={`customer-character-sprite is-${activity}`} style={{ backgroundImage: `url(${spriteUrl})` }} aria-hidden="true" />
      </button>
    </aside>
  );
}
