"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { START_STORY_HREF } from "../lib/site";

const chapters = [
  {
    number: "01",
    kicker: "PROLOGUE",
    title: "写真は、残っている。",
    emphasis: "でも、あの日の空気までは残せない。",
    copy: "名前を呼ぶと振り向いた顔。いつもの散歩道。隣で眠っていたぬくもり。写真の向こうにある時間まで、もう一度感じられるかたちへ。",
    scene: "SCENE 01 / THE FIRST DAY",
    sceneTitle: "家族になった、小さな春。",
    sceneNote: "はじめて家に来た日のこと",
  },
  {
    number: "02",
    kicker: "MEMORY INTERVIEW",
    title: "言葉にすると、",
    emphasis: "記憶は物語になる。",
    copy: "難しい文章や映像の指示は必要ありません。その子らしい癖、好きだった場所、忘れられない出来事を、やさしい質問に沿って聞かせてください。",
    scene: "QUESTION 03 / FAVORITE PLACE",
    sceneTitle: "いちばん好きだった散歩道は？",
    sceneNote: "あなたの言葉が、物語の輪郭になります",
  },
  {
    number: "03",
    kicker: "TWO FILM CONCEPTS",
    title: "物語を、まずは",
    emphasis: "2つのコンセプトに。",
    copy: "同じ思い出から、切り口の異なる2つの映像コンセプトをご提案します。心に近い1案を選んでいただき、場面や言葉を整えながら約1分の映画へ仕立てます。",
    scene: "CONCEPT A / THE WAY HOME",
    sceneTitle: "四季を歩いた、いつもの帰り道。",
    sceneNote: "2案を比べてから、制作する物語を選べます",
  },
  {
    number: "04",
    kicker: "WAN MEMORY",
    title: "あなたは、",
    emphasis: "思い出を話すだけ。",
    copy: "映像AIの使い方を覚える必要はありません。コンセプト提案から約1分の映画、専用サイトの仕上げまでお任せください。大切な時間を、何度でも会いにいけるかたちにします。",
    scene: "A FILM FOR YOUR FAMILY",
    sceneTitle: "モモと歩いた季節",
    sceneNote: "愛犬との時間を、いつまでも動く記憶に。",
  },
] as const;

export function ScrollMemoryStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(0);
  const snapTargetRef = useRef<number | null>(null);
  const wheelLockRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartChapterRef = useRef(0);
  const touchPinnedRef = useRef(false);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  const moveToChapter = useCallback((index: number) => {
    const section = sectionRef.current;
    if (!section) return;

    const safeIndex = Math.min(chapters.length - 1, Math.max(0, index));
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
    const target = sectionTop + scrollable * (safeIndex / (chapters.length - 1));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    snapTargetRef.current = safeIndex;
    activeRef.current = safeIndex;
    setActive(safeIndex);
    window.scrollTo({ top: target, behavior: reducedMotion ? "auto" : "smooth" });

    window.setTimeout(() => {
      if (snapTargetRef.current === safeIndex) snapTargetRef.current = null;
    }, reducedMotion ? 50 : 700);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let wheelUnlockTimer: number | undefined;

    const update = () => {
      frameRef.current = null;
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      const nextProgress = Math.min(1, Math.max(0, -rect.top / scrollable));
      const nextActive = Math.min(chapters.length - 1, Math.floor(nextProgress * chapters.length));

      setProgress(nextProgress);
      if (snapTargetRef.current === null) {
        activeRef.current = nextActive;
        setActive(nextActive);
      }
    };

    const requestUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(update);
    };

    const scheduleWheelUnlock = () => {
      window.clearTimeout(wheelUnlockTimer);
      wheelUnlockTimer = window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 700);
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < 10) return;

      const rect = section.getBoundingClientRect();
      const isPinned = rect.top <= 1 && rect.bottom >= window.innerHeight - 1;
      if (!isPinned) return;

      const direction = event.deltaY > 0 ? 1 : -1;
      const next = activeRef.current + direction;
      const canMove = next >= 0 && next < chapters.length;
      if (!canMove) return;

      event.preventDefault();
      if (wheelLockRef.current) {
        scheduleWheelUnlock();
        return;
      }

      wheelLockRef.current = true;
      moveToChapter(next);
      scheduleWheelUnlock();
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const rect = section.getBoundingClientRect();
      touchPinnedRef.current = rect.top <= 1 && rect.bottom >= window.innerHeight - 1;
      touchStartYRef.current = touch.clientY;
      touchStartChapterRef.current = activeRef.current;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      const touch = event.changedTouches[0];
      touchStartYRef.current = null;
      if (!touchPinnedRef.current || startY === null || !touch) return;
      const delta = startY - touch.clientY;
      if (Math.abs(delta) < 36) return;
      const direction = delta > 0 ? 1 : -1;
      const next = touchStartChapterRef.current + direction;
      if (next < 0 || next >= chapters.length) return;
      window.setTimeout(() => moveToChapter(next), 40);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    section.addEventListener("wheel", handleWheel, { passive: false });
    section.addEventListener("touchstart", handleTouchStart, { passive: true });
    section.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      section.removeEventListener("wheel", handleWheel);
      section.removeEventListener("touchstart", handleTouchStart);
      section.removeEventListener("touchend", handleTouchEnd);
      window.clearTimeout(wheelUnlockTimer);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [moveToChapter]);

  const chapter = chapters[active];

  return (
    <section className="scroll-story" id="memory-story" ref={sectionRef} aria-labelledby="scroll-story-title">
      <div className="scroll-story-sticky" data-step={active + 1}>
        <div className="story-backdrop" aria-hidden="true" />
        <div className="story-vignette" aria-hidden="true" />

        <div className="shell story-screen">
          <div className="story-copy" key={`copy-${active}`}>
            <p className="eyebrow light">A MEMORY BECOMES A FILM</p>
            <p className="story-kicker">
              <span>{chapter.number}</span>
              {chapter.kicker}
            </p>
            <h2 id="scroll-story-title">
              {chapter.title}
              <strong>{chapter.emphasis}</strong>
            </h2>
            <p className="story-body">{chapter.copy}</p>
            {active === chapters.length - 1 && (
              <Link className="button button-cream story-cta" href={START_STORY_HREF}>
                うちの子の物語をつくる <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          <div className="story-visual" key={`visual-${active}`} aria-label={`${chapter.scene} ${chapter.sceneTitle}`}>
            <div className="story-film-meta">
              <span>{chapter.scene}</span>
              <span>WAN MEMORY / {chapter.number}</span>
            </div>
            <div className="story-film-image" aria-hidden="true">
              <span className="story-focus-ring" />
              <span className="story-timecode">00:{active * 12 + 8}:04</span>
            </div>
            <div className="story-film-caption">
              <p>{chapter.sceneTitle}</p>
              <span>{chapter.sceneNote}</span>
            </div>
          </div>

          <nav className="story-chapter-nav" aria-label="思い出ストーリーの章">
            {chapters.map((item, index) => (
              <button
                type="button"
                key={item.number}
                className={index === active ? "active" : ""}
                aria-label={`${index + 1}章へ移動`}
                aria-current={index === active ? "step" : undefined}
                onClick={() => moveToChapter(index)}
              >
                <span>{item.number}</span>
              </button>
            ))}
          </nav>

          <div className="story-scroll-progress" aria-hidden="true">
            <span style={{ height: `${Math.max(progress * 100, 3)}%` }} />
          </div>
          <p className="story-scroll-label" aria-hidden="true">SCROLL TO CONTINUE</p>
        </div>
      </div>
    </section>
  );
}
