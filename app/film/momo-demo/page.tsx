import type { Metadata } from "next";
import Link from "next/link";
import { DemoFilmPlayer } from "./DemoFilmPlayer";
import { MemoryMotion } from "./MemoryMotion";
import { StartStoryLink } from "../../components/StartStoryLink";
import { APPLICATIONS_OPEN, PRELAUNCH_CTA } from "../../lib/site";

export const metadata: Metadata = {
  title: "愛犬メモリーフィルム完成例｜ひなたと歩いた、いつもの季節",
  description: "愛犬の写真とエピソードから制作する約1分の思い出動画と、家族専用メモリーサイトの完成イメージをご覧いただけます。",
  alternates: { canonical: "/film/momo-demo" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "愛犬メモリーフィルム完成例｜ひなたと歩いた、いつもの季節",
    description: "写真の向こうにある時間まで、実写映画のような映像へ。WAN MEMORYの完成デモです。",
    url: "/film/momo-demo",
    siteName: "WAN MEMORY",
    locale: "ja_JP",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "愛犬との時間を、いつまでも動く記憶に。" }],
  },
};

const memories = [
  ["01", "桜の花びらを追いかけた日", "地面に落ちた花びらが風で動くたび、ひなたがうれしそうに追いかけて、何度も私のほうへ戻ってきました。"],
  ["02", "玄関で待っていてくれる夕方", "鍵の音がすると顔だけを上げ、私だと分かった瞬間に立ち上がって近くまで来てくれます。"],
  ["03", "水辺をゆっくり歩く休日", "先を歩いていたひなたが何度も振り返って、私が追いつくまで立ち止まって待ってくれる時間が大好きです。"],
] as const;

export default function MomoDemoPage() {
  return (
    <main className="memory-demo-page">
      <MemoryMotion />
      <header className="memory-demo-header">
        <Link className="brand" href="/" aria-label="WAN MEMORY トップへ"><span className="brand-mark" aria-hidden="true">WM</span><span className="brand-type">WAN MEMORY<small>PRIVATE MEMORY FILM</small></span></Link>
        <span className="demo-badge">CUSTOMER DEMO</span>
        <Link className="memory-demo-close" href="/">サービスサイトへ戻る ↗</Link>
      </header>

      <div className="memory-demo-book" data-memory-book role="region" aria-label="ひなたのメモリーストーリー" tabIndex={0}>
      <section className="memory-demo-hero" data-memory-page>
        <div className="memory-demo-hero-image" aria-hidden="true" style={{ backgroundImage: "url('/film/hinata/hero-poster.jpg')" }} />
        <div className="memory-demo-hero-shade" aria-hidden="true" />
        <div className="memory-demo-hero-copy">
          <p>MEMORY FILM · HINATA</p>
          <h1>ひなたと歩いた、いつもの季節</h1>
          <span>柴犬 · 4歳　／　甘えん坊・元気・人が好き</span>
        </div>
        <p className="memory-demo-scroll" aria-hidden="true">SWIPE　→</p>
      </section>

      <section className="memory-demo-film" data-memory-page data-memory-reveal>
        <div className="memory-demo-shell">
          <div className="memory-demo-section-head"><div><p>01 / THE FILM</p><h2>いつでも、思い出せる映画。</h2></div><span>閲覧専用 · ダウンロード非対応</span></div>
          <DemoFilmPlayer />
          <p className="demo-film-note">※ デモ用に画面遷移を再現しています。実際のお客様ページでは完成した動画を再生できますが、ダウンロード機能は提供しません。画面録画などを完全に防止するものではありません。</p>
        </div>
      </section>

      <section className="memory-recollection" data-memory-page data-memory-reveal>
        <div className="memory-recollection-image" aria-hidden="true" style={{ backgroundImage: "url('/film/hinata/recollection.jpg')" }} />
        <div className="memory-recollection-shade" aria-hidden="true" />
        <div className="memory-recollection-copy">
          <p>WHEN A MEMORY RETURNS</p>
          <h2><span>目を閉じると、</span><br />あの日の光まで戻ってくる。</h2>
          <i aria-hidden="true" />
        </div>
      </section>

      <section className="memory-demo-story" data-memory-page data-memory-reveal>
        <div className="memory-demo-shell">
          <div className="memory-demo-section-head"><div><p>02 / OUR STORY</p><h2>ひなたと過ごした、<br />小さくて大切な日々。</h2></div><blockquote>「特別な日ではなくても、ひなたがいる毎日が私たちの物語でした。」</blockquote></div>
          <ol className="memory-chapter-list">{memories.map(([number, title, copy]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol>
        </div>
      </section>

      <section className="memory-demo-gallery" data-memory-page data-memory-reveal>
        <div className="memory-demo-shell">
          <div className="memory-demo-section-head"><div><p>03 / MOMENTS</p><h2>忘れたくない表情。</h2></div><span>家族が選んだ4枚</span></div>
          <div className="memory-gallery-grid" aria-label="ひなたの写真ギャラリー">
            <img src="/film/hinata/gallery-face.jpg" alt="ひなたの顔まわりの基準写真" />
            <img src="/film/hinata/gallery-body.jpg" alt="ひなたの全身の基準写真" />
            <img src="/film/hinata/gallery-side.jpg" alt="ひなたの横向き・尻尾の基準写真" />
            <img src="/film/hinata/gallery-water.jpg" alt="水辺を歩くひなた" />
          </div>
        </div>
      </section>

      <div className="memory-demo-final-page" data-memory-page>
      <section className="memory-demo-message" data-memory-reveal>
        <div className="memory-demo-shell">
          <p>04 / A LETTER FOR HINATA</p>
          <blockquote>ひなたへ。<br />特別なことがない日も、あなたと歩くと全部が大切な思い出になります。<br />これからも季節の匂いを一緒に見つけながら、ゆっくり同じ道を歩こうね。</blockquote>
          <span>FROM YOUR FAMILY</span>
        </div>
      </section>

      <footer className="memory-demo-footer" data-memory-reveal>
        <div><span className="brand-mark" aria-hidden="true">WM</span><p>THIS MEMORY PAGE WAS MADE FOR HINATA<br /><small>© WAN MEMORY</small></p></div>
        {APPLICATIONS_OPEN ? <StartStoryLink className="button button-cream">うちの子の映画を相談する →</StartStoryLink> : <span className="button button-prelaunch button-prelaunch-light" aria-disabled="true">{PRELAUNCH_CTA}</span>}
      </footer>
      </div>
      </div>
    </main>
  );
}
