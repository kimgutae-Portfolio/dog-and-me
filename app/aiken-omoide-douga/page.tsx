import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "愛犬の思い出動画を写真から制作";
const description = "愛犬の写真5枚とエピソードから、約1分の思い出動画をオーダーメイド制作。スライドショーではなく、その子らしい表情や動きを大切にした実写メモリーフィルムです。";

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
  ["愛犬の写真だけで動画を作れますか？", "はい。写真に加えて、その時の様子や愛犬らしい動きをエピソードとしてお聞きし、映像の構成をつくります。写真は合計5枚以上必要です。"],
  ["普通の写真スライドショーとは何が違いますか？", "原本写真を見せる場面に加え、外見を確認しながら短い動きのある場面を制作し、BGMと字幕で約1分の物語として編集します。"],
  ["AIで愛犬の顔が変わりませんか？", "生成表現には揺らぎが起こる可能性があります。WAN MEMORYでは基準写真を決め、顔・目・耳・毛色・体型などを人の目で確認し、お客様の確認後に納品します。"],
] as const;

export default function AikenOmoideDougaPage() {
  const structuredData = createGuideStructuredData({ path: "/aiken-omoide-douga", title, description, faqs });

  return (
    <InfoPage eyebrow="DOG MEMORY MOVIE" title="愛犬の写真から、思い出動画をつくる。" lead="何気ない散歩や寝顔、家族になった日のこと。写真の奥に残っている時間を、その子らしい約1分の映像に仕立てます。">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="seo-breadcrumb" aria-label="パンくずリスト"><Link href="/">WAN MEMORY</Link><span aria-hidden="true">/</span><span>愛犬の思い出動画</span></nav>

      <section className="seo-lead-panel">
        <p>愛犬の思い出動画は、写真を順番に並べるだけの記録ではありません。WAN MEMORYでは、お客様が覚えている動きや表情、場所の空気まで伺い、原本写真と短い映像表現を組み合わせます。</p>
        <ul><li>思い出2つ・写真合計5枚から相談可能</li><li>約1分のメモリーフィルム</li><li>BGMと短い字幕を中心に構成</li><li>完成前にお客様が映像を確認</li></ul>
      </section>

      <section><h2>写真だけでは分からない「その子らしさ」も映像へ</h2><p>同じ犬種でも、歩き方や振り返り方、家族を待つときの表情は一頭ずつ違います。申し込みフォームでは、写真と同じ場面のエピソードを項目ごとに入力できます。写真から確認できる事実と、お客様だけが知っている記憶を分けて整理し、実際になかった出来事を勝手につくらないことを大切にしています。</p></section>

      <section><h2>こんな思い出を残したい方へ</h2><div className="seo-card-grid"><article><strong>いつもの日常</strong><p>散歩、お昼寝、お迎えなど、今は当たり前に感じる時間を残します。</p></article><article><strong>家族になった日</strong><p>初めて会った日や家に来た頃の写真から、始まりの記憶を振り返ります。</p></article><article><strong>誕生日・記念日</strong><p>成長や毛並みの変化も含め、節目までの時間を一つの物語にします。</p></article></div></section>

      <section><h2>ご相談から完成まで</h2><ol className="seo-step-list"><li><span>01</span><div><strong>愛犬の情報と写真を送る</strong><p>顔、全身、横向きが分かる写真と、映像にしたい思い出を登録します。</p></div></li><li><span>02</span><div><strong>写真とエピソードを確認</strong><p>外見を維持するための基準と、映像にできる場面を担当者が整理します。</p></div></li><li><span>03</span><div><strong>方向性を選び、制作を進める</strong><p>料金と納期をご確認いただき、決済後に約1分の映像を制作します。</p></div></li><li><span>04</span><div><strong>確認・修正後に受け取る</strong><p>完成前の映像をご確認いただき、確定後に専用メモリーサイトでお届けします。</p></div></li></ol></section>

      <section><h2>制作に向いている写真</h2><p>顔と目が鮮明で、毛色や体型が自然に分かる写真が基準になります。正面の顔、全身、横向きやしっぽが分かる写真を含めると、外見を判断しやすくなります。</p><Link className="text-link" href="/dog-photo-guide">愛犬写真の選び方を詳しく見る →</Link></section>

      <section className="seo-faq"><h2>愛犬の思い出動画についてよくある質問</h2>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}</section>

      <aside className="seo-cta"><p>写真が揃っているか分からなくても大丈夫です。</p><h2>まずは、その子のことを聞かせてください。</h2><div><StartStoryLink className="button button-primary">制作を相談する →</StartStoryLink><Link className="button button-outline" href="/film/momo-demo">完成デモを見る</Link></div></aside>
      <SeoGuideLinks currentPath="/aiken-omoide-douga" />
    </InfoPage>
  );
}
