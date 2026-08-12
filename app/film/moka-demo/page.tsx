import type { Metadata } from "next";
import Link from "next/link";
import { StartStoryLink } from "../../components/StartStoryLink";
import { MokaGuide } from "./MokaGuide";

/* eslint-disable @next/next/no-img-element -- Static WebP album assets preserve their original aspect ratios. */

export const metadata: Metadata = {
  title: "愛犬の動く絵本 制作例｜モカと、五つの記憶",
  description:
    "愛犬の写真と五つの思い出から生まれた、WAN MEMORYの動く絵本『モカと、五つの記憶』の完成作品と写真アルバムです。",
  alternates: { canonical: "/film/moka-demo" },
  openGraph: {
    title: "モカと、五つの記憶｜WAN MEMORY",
    description: "雨の日、はじめての旅、パンの香る朝。モカの五つの記憶をつないだ動く絵本。",
    url: "/film/moka-demo",
    images: [
      {
        url: "/film/moka/05-storybook-lantern.webp",
        width: 1672,
        height: 941,
        alt: "モカと、五つの記憶",
      },
    ],
  },
};

const album = [
  { src: "/film/moka/01-storybook-rain.webp", title: "雨音を待つ玄関", width: 1672, height: 941 },
  { src: "/film/moka/10-lantern-evening.webp", title: "灯りを眺める夕べ", width: 1448, height: 1086 },
  { src: "/film/moka/02-storybook-train.webp", title: "はじめての電車旅", width: 1672, height: 941 },
  { src: "/film/moka/09-autumn-ginkgo.webp", title: "銀杏色の散歩道", width: 1447, height: 1087 },
  { src: "/film/moka/03-storybook-bread.webp", title: "パンの香る朝", width: 1672, height: 941 },
  { src: "/film/moka/06-rainy-entryway.webp", title: "雨の日の記憶", width: 1448, height: 1086 },
  { src: "/film/moka/05-storybook-lantern.webp", title: "夕暮れの窓辺", width: 1672, height: 941 },
  { src: "/film/moka/07-first-train-trip.webp", title: "小さな駅にて", width: 1448, height: 1086 },
  { src: "/film/moka/04-storybook-autumn.webp", title: "秋色の散歩", width: 1672, height: 941 },
  { src: "/film/moka/08-bread-morning.webp", title: "朝のいい匂い", width: 1448, height: 1086 },
] as const;

export default function MokaDemoPage() {
  return (
    <main className="moka-demo">
      <header className="moka-nav">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">WM</span>
          <span className="brand-type">
            WAN MEMORY<small>MOVING STORYBOOK</small>
          </span>
        </Link>
        <span>COMPLETE STORYBOOK SAMPLE</span>
        <Link href="/">サービスサイトへ戻る ↗</Link>
      </header>

      <section className="moka-cover">
        <img
          src="/film/moka/05-storybook-lantern.webp"
          alt="灯りの見える窓辺でくつろぐモカ"
        />
        <div className="moka-cover-wash" aria-hidden="true" />
        <div className="moka-cover-copy">
          <p>A STORY FOR MOKA</p>
          <h1>モカと、<br />五つの記憶</h1>
          <span>トイプードル · いつもの日々をめぐる物語</span>
          <a href="#complete-film">作品を再生する <i aria-hidden="true">↓</i></a>
        </div>
      </section>

      <section className="moka-complete-film" id="complete-film">
        <div className="moka-shell">
          <div className="moka-heading">
            <div>
              <p>01 / COMPLETE FILM</p>
              <h2>五つの記憶を、<br />一冊の映像に。</h2>
            </div>
            <span>約54秒 · 画面を大きくしてお楽しみください</span>
          </div>
          <div className="moka-main-player">
            <video
              controls
              preload="metadata"
              playsInline
              poster="/film/moka/05-storybook-lantern.webp"
              aria-label="モカと五つの記憶の完成映像"
            >
              <source src="/film/moka/complete-film.mp4" type="video/mp4" />
            </video>
          </div>
          <p className="moka-note">雨音、旅、朝の匂い、秋の散歩、夕暮れの灯り。家族が覚えている時間を一つの物語としてつないでいます。</p>
        </div>
      </section>

      <section className="moka-album" id="moka-album">
        <div className="moka-shell">
          <div className="moka-heading">
            <div>
              <p>02 / MOKA&apos;S PHOTO ALBUM</p>
              <h2>モカの時間を、<br />一つの写真帖に。</h2>
            </div>
            <span>五つの思い出から生まれた10枚</span>
          </div>
          <p className="moka-album-intro">
            制作に使った写真も、物語のために描いた一場面も、ここでは区別せずモカのアルバムとして並べています。
          </p>
          <ol className="moka-album-grid" aria-label="モカの写真アルバム。スマートフォンでは左右にスワイプできます。">
            {album.map((photo, index) => (
              <li key={photo.src}>
                <figure>
                  <img
                    src={photo.src}
                    alt={`${photo.title}のアルバム写真`}
                    width={photo.width}
                    height={photo.height}
                    loading="lazy"
                  />
                  <figcaption><span>{String(index + 1).padStart(2, "0")}</span>{photo.title}</figcaption>
                </figure>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="moka-letter" id="moka-letter">
        <p>03 / A LETTER FOR MOKA</p>
        <blockquote>
          モカへ。<br />雨の日も、遠くへ出かけた日も、<br />何気ない朝も、ぜんぶ大切な物語だよ。
        </blockquote>
        <span>FROM YOUR FAMILY</span>
      </section>

      <footer className="moka-footer">
        <div>
          <span className="brand-mark" aria-hidden="true">WM</span>
          <p>THIS STORY WAS DRAWN FOR MOKA<br /><small>© WAN MEMORY</small></p>
        </div>
        <StartStoryLink className="button button-cream">うちの子の物語を相談する →</StartStoryLink>
      </footer>
      <MokaGuide />
    </main>
  );
}
