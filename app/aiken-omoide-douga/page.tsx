import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "愛犬の思い出動画を写真から制作";
const description = "愛犬の写真とエピソードから、実写に近い愛犬の質感とやわらかな絵画表現を組み合わせた約1分の思い出動画をオーダーメイド制作します。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/aiken-omoide-douga" },
  openGraph: {
    title: `${title}｜WAN MEMORY`,
    description,
    url: "/aiken-omoide-douga",
    type: "website",
    locale: "ja_JP",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "愛犬の写真から思い出動画を制作するWAN MEMORY" }],
  },
};

const faqs = [
  ["愛犬の写真だけで動画を作れますか？", "はい。お顔・全身・横向きの基準写真3枚をお預かりし、その時の様子や愛犬らしい動きをエピソードとしてお聞きして映像の構成をつくります。思い出ごとの場面写真は任意です。"],
  ["普通の写真スライドショーとは何が違いますか？", "原本写真を見せる場面に加え、写真とエピソードをもとに新しい場面イメージを制作し、短い動き、BGM、字幕で約1分の物語として編集します。"],
  ["写真がそのまま実写動画になりますか？", "いいえ。愛犬は写真の特徴を参考に実写に近い質感で、背景や光はやわらかな絵画表現で新しく制作します。完全な実写再現ではなく、顔や身体などの細部が元写真と異なる場合があります。"],
  ["AIで愛犬の顔が変わりませんか？", "生成表現には揺らぎが起こる可能性があります。WAN MEMORYでは基準写真を決め、顔・目・耳・毛色・体型などを人の目で確認し、映像化前の場面イメージをお客様にご確認いただきます。"],
] as const;

export default function AikenOmoideDougaPage() {
  const structuredData = createGuideStructuredData({ path: "/aiken-omoide-douga", title, description, faqs });

  return (
    <InfoPage eyebrow="DOG MEMORY MOVIE" title="愛犬の写真から、思い出動画をつくる。" lead="何気ない散歩や寝顔、家族になった日のこと。写真の奥に残っている時間を、その子らしい約1分の映像に仕立てます。">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="seo-breadcrumb" aria-label="パンくずリスト"><Link href="/">WAN MEMORY</Link><span aria-hidden="true">/</span><span>愛犬の思い出動画</span></nav>

      <section className="seo-lead-panel">
        <p>愛犬の思い出動画は、写真を順番に並べるだけの記録ではありません。愛犬は実写に近い質感で、背景や光は記憶をたどるようなやわらかな絵画表現で仕上げ、原本写真と組み合わせます。</p>
        <ul><li>元写真をそのまま動かす完全な実写再現ではありません</li><li>基準写真3枚と思い出3つから相談可能</li><li>約1分・BGMと短い字幕で構成</li><li>映像化の前に場面イメージを確認</li></ul>
      </section>

      <section><h2>WAN MEMORYの仕上がりについて</h2><p>写真から分かる顔・毛色・体型を大切にしながら、写真には写っていない動きや風景を新しい場面として制作します。愛犬は実写に近い質感を保ち、背景や光にはやわらかな絵画表現を加えます。AIによる生成表現のため完全な同一性は保証できませんが、場面イメージを先にご確認いただき、了承を得てから映像化します。</p><Link className="text-link" href="/film/hinata-demo">実際の仕上がりを確認する →</Link></section>

      <section><h2>写真だけでは分からない「その子らしさ」も映像へ</h2><p>同じ犬種でも、歩き方や振り返り方、家族を待つときの表情は一頭ずつ違います。申し込みフォームでは、写真と同じ場面のエピソードを項目ごとに入力できます。写真から確認できる事実と、お客様だけが知っている記憶を分けて整理し、実際になかった出来事を勝手につくらないことを大切にしています。</p></section>

      <section><h2>こんな思い出を残したい方へ</h2><div className="seo-card-grid"><article><strong>いつもの日常</strong><p>散歩、お昼寝、お迎えなど、今は当たり前に感じる時間を残します。</p></article><article><strong>家族になった日</strong><p>初めて会った日や家に来た頃の写真から、始まりの記憶を振り返ります。</p></article><article><strong>誕生日・記念日</strong><p>成長や毛並みの変化も含め、節目までの時間を一つの物語にします。</p></article></div></section>

      <section><h2>ご相談から完成まで</h2><ol className="seo-step-list"><li><span>01</span><div><strong>愛犬の情報と写真を送る</strong><p>顔、全身、横向きが分かる写真と、映像にしたい思い出を登録します。</p></div></li><li><span>02</span><div><strong>写真とエピソードを確認</strong><p>外見を維持するための基準と、映像にできる場面を担当者が整理します。</p></div></li><li><span>03</span><div><strong>方向性を選び、制作を進める</strong><p>料金と納期をご確認いただき、決済後に約1分の映像を制作します。</p></div></li><li><span>04</span><div><strong>確認・修正後に受け取る</strong><p>完成前の映像をご確認いただき、確定後に専用メモリーサイトでお届けします。</p></div></li></ol></section>

      <section><h2>制作に向いている写真</h2><p>顔と目が鮮明で、毛色や体型が自然に分かる写真が基準になります。正面の顔、全身、横向きやしっぽが分かる写真を含めると、外見を判断しやすくなります。</p><Link className="text-link" href="/dog-photo-guide">愛犬写真の選び方を詳しく見る →</Link></section>

      <section className="seo-faq"><h2>愛犬の思い出動画についてよくある質問</h2>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}</section>

      <aside className="seo-cta"><p>写真が揃っているか分からなくても大丈夫です。</p><h2>まずは、その子のことを聞かせてください。</h2><div><StartStoryLink className="button button-primary">制作を相談する →</StartStoryLink><Link className="button button-outline" href="/film/hinata-demo">完成デモを見る</Link></div></aside>
      <SeoGuideLinks currentPath="/aiken-omoide-douga" />
    </InfoPage>
  );
}
