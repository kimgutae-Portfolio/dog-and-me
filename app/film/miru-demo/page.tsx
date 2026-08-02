import type { Metadata } from "next";
import Link from "next/link";
import { StartStoryLink } from "../../components/StartStoryLink";
import { MiruStorybookPlayer } from "./MiruStorybookPlayer";

export const metadata: Metadata = {
  title: "愛犬の動く絵本 制作例｜ミルと、ひとひらの春",
  description:
    "愛犬の写真とエピソードから描くWAN MEMORYの動く絵本『ミルと、ひとひらの春』の制作例です。",
  alternates: { canonical: "/film/miru-demo" },
  openGraph: {
    title: "ミルと、ひとひらの春｜WAN MEMORY",
    description: "一枚の花びらが三つの記憶をつなぐ、愛犬の動く絵本。",
    url: "/film/miru-demo",
    images: [
      { url: "/og.png", width: 1200, height: 630, alt: "ミルと、ひとひらの春" },
    ],
  },
};

const chapters = [
  [
    "01",
    "春風から届いた手紙",
    "春の日、小さな手紙が届きました。",
    "/film/miru/01-spring-letter.jpg",
  ],
  [
    "02",
    "桜色の旅",
    "ひとひらは、知らない青へ。",
    "/film/miru/02-color-journey.jpg",
  ],
  [
    "03",
    "はじめての波",
    "その先で、はじめての波に出会いました。",
    "/film/miru/03-first-wave.jpg",
  ],
] as const;

export default function MiruDemoPage() {
  return (
    <main className="miru-book-demo">
      <header className="miru-book-nav">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            WM
          </span>
          <span className="brand-type">
            WAN MEMORY<small>MOVING STORYBOOK</small>
          </span>
        </Link>
        <span>STORYBOOK SAMPLE</span>
        <Link href="/">サービスサイトへ戻る ↗</Link>
      </header>
      <section className="miru-book-cover">
        <div className="miru-book-cover-image" aria-hidden="true" />
        <div>
          <p>A STORY FOR MIRU</p>
          <h1>
            ミルと、
            <br />
            ひとひらの春
          </h1>
          <span>マルチーズ · はじめての春とはじめての海</span>
        </div>
      </section>
      <section className="miru-book-motion">
        <div className="miru-book-shell">
          <div className="miru-book-heading">
            <div>
              <p>01 / A PAGE COMES ALIVE</p>
              <h2>
                絵本の一ページが、
                <br />
                そっと動きはじめる。
              </h2>
            </div>
            <span>5秒の制作テスト</span>
          </div>
          <MiruStorybookPlayer />
          <p className="miru-book-note">
            犬を大きく演技させず、花びら、まばたき、風、水面などに控えめな動きを加えます。このページは現在の表現テストです。
          </p>
        </div>
      </section>
      <section className="miru-book-chapters">
        <div className="miru-book-shell">
          <div className="miru-book-heading">
            <div>
              <p>02 / STORY PAGES</p>
              <h2>
                ひとひらが、
                <br />
                記憶と記憶をつなぐ。
              </h2>
            </div>
            <blockquote>「あの日の桜は、海の青まで覚えていた。」</blockquote>
          </div>
          <ol>
            {chapters.map(([number, title, sentence, image]) => (
              <li key={number}>
                <img src={image} alt={`${title}の絵本ページ`} />
                <div>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{sentence}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="miru-book-letter">
        <p>03 / A LETTER FOR MIRU</p>
        <blockquote>
          ミルへ。
          <br />
          はじめて見つけた色も、音も、風も、
          <br />
          これから少しずつ宝物にしていこうね。
        </blockquote>
        <span>FROM YOUR FAMILY</span>
      </section>
      <footer className="miru-book-footer">
        <div>
          <span className="brand-mark" aria-hidden="true">
            WM
          </span>
          <p>
            THIS STORY WAS DRAWN FOR MIRU
            <br />
            <small>© WAN MEMORY</small>
          </p>
        </div>
        <StartStoryLink className="button button-cream">
          うちの子の物語を相談する →
        </StartStoryLink>
      </footer>
    </main>
  );
}
