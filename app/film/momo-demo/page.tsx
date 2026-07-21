import type { Metadata } from "next";
import Link from "next/link";
import { DemoFilmPlayer } from "./DemoFilmPlayer";
import { MemoryMotion } from "./MemoryMotion";
import { APPLICATIONS_OPEN, PRELAUNCH_CTA, START_STORY_HREF } from "../../lib/site";

export const metadata: Metadata = {
  title: "愛犬メモリアルムービー完成例｜モモと歩いた季節",
  description: "愛犬の写真とエピソードから制作する約1分の思い出動画と、家族専用メモリーサイトの完成イメージをご覧いただけます。",
  alternates: { canonical: "/film/momo-demo" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "愛犬メモリアルムービー完成例｜モモと歩いた季節",
    description: "写真の向こうにある時間まで、実写映画のような映像へ。WAN MEMORYの完成デモです。",
    url: "/film/momo-demo",
    siteName: "WAN MEMORY",
    locale: "ja_JP",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "愛犬との時間を、いつまでも動く記憶に。" }],
  },
};

const memories = [
  ["01", "家族になった春", "小さなモモが玄関で少しだけ震えていた日。抱き上げると、すぐに腕の中で眠りました。"],
  ["02", "いつもの散歩道", "雨の日も、暑い日も、曲がり角では必ずこちらを見て待っていてくれました。"],
  ["03", "窓辺の特等席", "午後の光が入る窓辺はモモの場所。家族の声を聞きながら、安心した顔で眠っていました。"],
  ["04", "これからの時間", "急がなくていいから、これからも同じ道を一緒にゆっくり歩いていこう。"],
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

      <section className="memory-demo-hero" data-memory-page>
        <div className="memory-demo-hero-image" aria-hidden="true" />
        <div className="memory-demo-hero-shade" aria-hidden="true" />
        <div className="memory-demo-hero-copy">
          <p>MEMORY FILM · MOMO</p>
          <h1>モモと歩いた季節</h1>
          <span>柴犬 · 12歳　／　家族になった日 2014.04.12</span>
        </div>
        <p className="memory-demo-scroll" aria-hidden="true">OUR STORY　↓</p>
      </section>

      <section className="memory-demo-film" data-memory-page data-memory-reveal>
        <div className="memory-demo-shell">
          <div className="memory-demo-section-head"><div><p>01 / THE FILM</p><h2>何度でも、会いにいける映画。</h2></div><span>閲覧専用 · ダウンロード非対応</span></div>
          <DemoFilmPlayer />
          <p className="demo-film-note">※ デモ用に画面遷移を再現しています。実際のお客様ページでは完成した動画を再生できますが、ダウンロード機能は提供しません。画面録画などを完全に防止するものではありません。</p>
        </div>
      </section>

      <section className="memory-recollection" data-memory-page data-memory-reveal>
        <div className="memory-recollection-image" aria-hidden="true" />
        <div className="memory-recollection-shade" aria-hidden="true" />
        <div className="memory-recollection-copy">
          <p>WHEN A MEMORY RETURNS</p>
          <h2><span>目を閉じると、</span><br />あの日の光まで戻ってくる。</h2>
          <i aria-hidden="true" />
        </div>
      </section>

      <section className="memory-demo-story" data-memory-page data-memory-reveal>
        <div className="memory-demo-shell">
          <div className="memory-demo-section-head"><div><p>02 / OUR STORY</p><h2>モモと過ごした、<br />小さくて大切な日々。</h2></div><blockquote>「特別な日ではなくても、モモがいる毎日が私たちの物語でした。」</blockquote></div>
          <ol className="memory-chapter-list">{memories.map(([number, title, copy]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol>
        </div>
      </section>

      <section className="memory-demo-gallery" data-memory-page data-memory-reveal>
        <div className="memory-demo-shell">
          <div className="memory-demo-section-head"><div><p>03 / MOMENTS</p><h2>忘れたくない表情。</h2></div><span>家族が選んだ4枚</span></div>
          <div className="memory-gallery-grid" aria-label="モモの写真ギャラリー"><div /><div /><div /><div /></div>
        </div>
      </section>

      <section className="memory-demo-message" data-memory-page data-memory-reveal>
        <div className="memory-demo-shell">
          <p>04 / A LETTER FOR MOMO</p>
          <blockquote>モモへ。<br />いつも私たちの真ん中にいてくれて、ありがとう。<br />これからも一緒に、ゆっくり歩こうね。</blockquote>
          <span>FROM YOUR FAMILY</span>
        </div>
      </section>

      <footer className="memory-demo-footer" data-memory-reveal>
        <div><span className="brand-mark" aria-hidden="true">WM</span><p>THIS MEMORY PAGE WAS MADE FOR MOMO<br /><small>© WAN MEMORY</small></p></div>
        {APPLICATIONS_OPEN ? <Link className="button button-cream" href={START_STORY_HREF}>うちの子の映画を相談する →</Link> : <span className="button button-prelaunch button-prelaunch-light" aria-disabled="true">{PRELAUNCH_CTA}</span>}
      </footer>
    </main>
  );
}
