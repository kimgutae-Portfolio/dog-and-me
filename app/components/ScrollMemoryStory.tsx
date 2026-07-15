"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
    kicker: "STORY DIRECTION",
    title: "物語は場面になり、",
    emphasis: "一本の映画へ。",
    copy: "お預かりした写真とエピソードから構成をつくり、実写素材と映像表現をつなぎます。顔や毛色、しぐさを人の目で確かめながら、その子だけの映画に仕立てます。",
    scene: "SCENE 07 / THE WAY HOME",
    sceneTitle: "夕暮れの、いつもの帰り道。",
    sceneNote: "シーンと物語は制作前に確認できます",
  },
  {
    number: "04",
    kicker: "WAN MEMORY",
    title: "あなたは、",
    emphasis: "思い出を話すだけ。",
    copy: "映像AIの使い方を覚える必要はありません。ストーリーづくりから仕上げ、修正までお任せください。大切な時間を、何度でも会いにいける映画にします。",
    scene: "A FILM FOR YOUR FAMILY",
    sceneTitle: "モモと歩いた季節",
    sceneNote: "愛犬との時間を、いつまでも動く記憶に。",
  },
] as const;

export function ScrollMemoryStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      frameRef.current = null;
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      const nextProgress = Math.min(1, Math.max(0, -rect.top / scrollable));
      const nextActive = Math.min(chapters.length - 1, Math.floor(nextProgress * chapters.length));

      setProgress(nextProgress);
      setActive(nextActive);
    };

    const requestUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const chapter = chapters[active];

  const moveToChapter = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
    const target = sectionTop + scrollable * ((index + 0.08) / chapters.length);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: target, behavior: reducedMotion ? "auto" : "smooth" });
  };

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
              <Link className="button button-cream story-cta" href="/story">
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
