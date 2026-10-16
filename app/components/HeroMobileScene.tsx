"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackEvent } from "../lib/analytics";
import { HeroDogDash } from "./HeroDogDash";

const scenes = [
  { label: "写真が絵本に", title: "いつもの写真が、絵本の一ページに。", copy: "毛色やしぐさを、水彩でやさしく描きます。" },
  { label: "思い出が動画に", title: "5つの思い出が、ひとつの物語に。", copy: "文章とBGMを添えた、約40秒の動く絵本。" },
  { label: "専用ホームページ", title: "完成後も、思い出が増えていく。", copy: "写真を追加して、ご家族といつでも見返せます。" },
];
export function HeroMobileScene() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [showcaseReady, setShowcaseReady] = useState(false);
  const [inView, setInView] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [fullVideo, setFullVideo] = useState(false);
  const [muted, setMuted] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [artVisible, setArtVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseTemporarily = () => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 8000);
  };

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 640px)");
    const updateMobile = () => setMobile(mobileQuery.matches);
    const update = () => setReduced(motion.matches);
    const frame = requestAnimationFrame(() => { update(); updateMobile(); }); motion.addEventListener("change", update);
    mobileQuery.addEventListener("change", updateMobile);
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      document.documentElement.toggleAttribute("data-hero-service-in-view", entry.isIntersecting);
    }, { threshold: .5 });
    if (root.current) observer.observe(root.current);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener("change", update); mobileQuery.removeEventListener("change", updateMobile); observer.disconnect(); document.documentElement.removeAttribute("data-hero-service-in-view"); };
  }, []);
  useEffect(() => {
    if (!mobile || reduced) return;
    // Start the first slide's clock when its own entrance finishes, not when the dogs return.
    // A finished animation is still available after late hydration because it uses fill: both.
    const entrance = root.current?.getAnimations().find(animation =>
      "animationName" in animation && animation.animationName === "hero-service-enter"
    );
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      if (entrance && entrance.playState !== "finished") setShowcaseReady(false);
      await entrance?.finished;
      if (!cancelled) setShowcaseReady(true);
    }).catch(() => {
      // A cancelled entrance is rechecked if the viewport or motion preference changes.
    });
    return () => { cancelled = true; };
  }, [mobile, reduced]);
  useEffect(() => {
    if (!showcaseReady || paused || keyboardFocused || reduced || (playing && fullVideo) || !inView || !pageVisible || !mobile) return;
    const timer = setTimeout(() => {
      if (document.hidden) return;
      setCurrent(prev => (prev + 1) % scenes.length);
    }, 4000);
    return () => clearTimeout(timer);
  }, [showcaseReady, paused, keyboardFocused, reduced, playing, fullVideo, inView, pageVisible, mobile, current]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (current !== 1 || !inView || !pageVisible || !mobile) {
      element.pause();
      return;
    }
    if (fullVideo || reduced) return;
    element.muted = true;
    element.play().catch(() => {
      // Leave the manual play button available when autoplay is blocked.
    });
  }, [current, inView, pageVisible, mobile, fullVideo, reduced]);
  useEffect(() => {
    if (current !== 0 || reduced || !showcaseReady || paused || !inView || !pageVisible || !mobile) return;
    const reset = setTimeout(() => setArtVisible(false), 0);
    const timer = setTimeout(() => setArtVisible(true), 1200);
    return () => { clearTimeout(reset); clearTimeout(timer); };
  }, [current, inView, pageVisible, mobile, reduced, showcaseReady, paused]);

  const select = (index: number) => {
    setCurrent(index); pauseTemporarily(); setPlaying(false); setFullVideo(false); setMuted(true);
    trackEvent("hero_service_select", { service: index + 1, page_path: "/" });
  };
  return <><div ref={root} className="hero-service-showcase" role="region" aria-label="写真から始まる、3つの楽しみ" aria-roledescription="カルーセル" onFocus={event => { if (event.target.matches(":focus-visible")) setKeyboardFocused(true); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocused(false); }}>
    <div className="hero-service-viewport" onTouchStart={event => { const touch = event.touches[0]; swipeStart.current = { x: touch.clientX, y: touch.clientY }; }} onTouchEnd={event => { const touch = event.changedTouches[0]; const start = swipeStart.current; swipeStart.current = null; if (!start) return; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) select((current + (dx < 0 ? 1 : 2)) % 3); }}>
      {scenes.map((scene, index) => <section key={scene.label} className={`hero-service-slide${current === index ? " is-active" : ""}`} aria-hidden={current !== index} inert={current !== index} aria-label={`${index + 1} / 3：${scene.label}`}>
        <div className={`hero-service-media media-${index}`}>
          {index === 0 && <>
            <Image src="/film/moka/09-autumn-ginkgo.webp" alt="秋の散歩道を歩くモカのサンプル写真" fill loading="eager" sizes="(max-width:640px) 90vw, 1px" />
            <Image className={artVisible ? "hero-art-image is-revealed" : "hero-art-image"} src="/film/moka/04-storybook-autumn.webp" alt="写真をもとに水彩で描いた完成絵本ページ" fill sizes="(max-width:640px) 90vw, 1px" />
            <button className="hero-example-toggle" type="button" onClick={() => { setArtVisible(value => !value); pauseTemporarily(); }}>{artVisible ? "元の写真を見る" : "絵本ページを見る"} <span aria-hidden="true">⇄</span></button>
          </>}
          {index === 1 && <>
            <video ref={video} controls={fullVideo} muted={muted} loop={!fullVideo} playsInline preload="none" poster="/film/moka/05-storybook-lantern.webp" aria-label="モカの完成した動く絵本" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setFullVideo(false); setMuted(true); setCurrent(2); }}><source src="/film/moka/complete-film.mp4" type="video/mp4" /></video>
            {(!fullVideo || !playing) && <button className="hero-film-play" type="button" onClick={() => { setFullVideo(true); setMuted(false); const element = video.current; if (element) { element.muted = false; element.currentTime = 0; element.play().catch(() => setPlaying(false)); } trackEvent("hero_film_play", { page_path: "/" }); }}><span aria-hidden="true">▶</span>{playing ? "音声つきで全編を見る" : "完成動画を再生"}</button>}
          </>}
          {index === 2 && <Link className="hero-phone-link" href="/film/moka-demo" tabIndex={current === 2 ? 0 : -1} onClick={() => trackEvent("hero_website_click", { page_path: "/" })}>
            <div className="hero-service-phone"><div className="hero-phone-notch" /><Image src="/film/moka/05-storybook-lantern.webp" alt="モカの完成作品を表示した専用ホームページのイメージ" width={1672} height={941} /><strong>モカと、五つの記憶</strong><div className="hero-phone-album"><Image src="/film/moka/06-rainy-entryway.webp" alt="" width={1448} height={1086} /><Image src="/film/moka/09-autumn-ginkgo.webp" alt="" width={1447} height={1087} /><span>＋</span></div></div>
            <span className="hero-phone-benefits"><strong>写真を追加</strong><strong>家族に共有</strong><small>月額料金なし</small><span className="hero-phone-cta"><span>実際のページ<br />を見る</span><span aria-hidden="true">↗</span></span></span>
          </Link>}
          <span className="hero-service-number" aria-hidden="true">0{index + 1}</span>
        </div>
        <div className="hero-service-description"><h2>{scene.title}</h2><p>{scene.copy}</p></div>
      </section>)}
    </div>
    <div className="hero-service-controls">
      <button type="button" className="hero-service-arrow" aria-label="前のサービスを見る" onClick={() => select((current + 2) % 3)}>‹</button>
      <div className="hero-service-dots">{scenes.map((scene, index) => <button key={scene.label} type="button" aria-label={scene.label} aria-pressed={current === index} onClick={() => select(index)}><span />{index + 1}</button>)}</div>
      <button type="button" className="hero-service-arrow" aria-label="次のサービスを見る" onClick={() => select((current + 1) % 3)}>›</button>
    </div>
  </div>
    <div className="hero-dog-lane" aria-hidden="true">
      <HeroDogDash paused={!inView} />
    </div>
  </>;
}
