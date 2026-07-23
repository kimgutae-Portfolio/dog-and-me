import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "うちの子記念日の動画を愛犬の写真から制作";
const description = "愛犬のうちの子記念日や誕生日に、出会った日から今までの写真とエピソードを約1分の思い出動画へ。WAN MEMORYのオーダーメイド映像制作をご案内します。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/uchinoko-kinenbi-douga" },
  openGraph: { title: `${title}｜WAN MEMORY`, description, url: "/uchinoko-kinenbi-douga", type: "website", locale: "ja_JP", images: [{ url: "/og.png", width: 1200, height: 630, alt: "うちの子記念日の愛犬動画制作" }] },
};

const faqs = [
  ["うちの子記念日の日付が正確に分からなくても作れますか？", "はい。正確な日付が分からない場合は、季節や当時の年齢など覚えている範囲で構成できます。分からない情報を推測して確定的に表現することはありません。"],
  ["子犬の頃と今で毛の長さが違っていても大丈夫ですか？", "はい。どの時期の姿として表現するかを確認し、場面ごとの写真を基準にします。特に残したい毛の長さや表情も指定できます。"],
  ["誕生日の写真がなくても制作できますか？", "できます。誕生日当日の再現に限定せず、散歩や家で過ごす様子など、その子らしい一年を振り返る構成をご提案します。"],
] as const;

export default function UchinokoKinenbiPage() {
  const structuredData = createGuideStructuredData({ path: "/uchinoko-kinenbi-douga", title, description, faqs });
  return (
    <InfoPage eyebrow="ANNIVERSARY FILM" title="うちの子記念日を、これからも見返せる映像に。" lead="家族になった日、初めて眠った場所、いつもの散歩道。出会った頃から今までの写真を、その子らしい物語として残します。">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="seo-breadcrumb" aria-label="パンくずリスト"><Link href="/">WAN MEMORY</Link><span aria-hidden="true">/</span><span>うちの子記念日動画</span></nav>

      <section className="seo-lead-panel"><p>うちの子記念日は、愛犬が家族になった大切な節目です。きれいな記念写真だけではなく、迎えた日の少し不安そうな顔や、初めて安心して眠った姿も、そのご家族だけの物語になります。</p></section>

      <section><h2>特別な一日だけでなく、そこまでの日々を残す</h2><p>WAN MEMORYの記念日動画は、ケーキや飾り付けの場面だけをつなぐものではありません。家族になった頃、好きになった場所、今の表情など、2〜6個のエピソードから約1分の流れを組み立てます。写真ごとの毛の長さや年齢の違いも、成長の記録として丁寧に扱います。</p></section>

      <section><h2>約1分の構成例</h2><ol className="seo-step-list"><li><span>01</span><div><strong>家族になった頃</strong><p>最初に撮った写真と、出会った日の記憶から始めます。</p></div></li><li><span>02</span><div><strong>好きになった日常</strong><p>散歩道、遊び、寝顔など、その子らしい場面をつなぎます。</p></div></li><li><span>03</span><div><strong>今の表情</strong><p>最近の基準写真を使い、現在の顔や体型を大切に表現します。</p></div></li><li><span>04</span><div><strong>これからの時間</strong><p>「また明日も、いつもの道を。」という今を残すエンディングで結びます。</p></div></li></ol></section>

      <section><h2>用意すると伝わりやすい写真</h2><div className="seo-card-grid"><article><strong>初期の写真</strong><p>家族になった頃の顔や身体の大きさが分かる写真。</p></article><article><strong>その子らしい場面</strong><p>好きな場所、服、おもちゃ、しぐさが写っている写真。</p></article><article><strong>現在の基準写真</strong><p>最近の顔・全身・横向きが鮮明に分かる写真。</p></article></div><Link className="text-link" href="/dog-photo-guide">写真準備ガイドを見る →</Link></section>

      <section><h2>完成映像と専用ページ</h2><p>完成した約1分の動画だけでなく、選んだ写真やメッセージをまとめる専用メモリーサイトもプランに含まれます。ページは検索結果に表示されず、専用URLから何度でも見返せます。</p><Link className="text-link" href="/film/momo-demo">完成ページのデモを体験する →</Link></section>

      <section className="seo-faq"><h2>うちの子記念日動画についてよくある質問</h2>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}</section>

      <aside className="seo-cta"><p>次の記念日に間に合う納期を確認します。</p><h2>愛犬との時間を、一本の思い出動画に。</h2><div><StartStoryLink className="button button-primary">制作を相談する →</StartStoryLink><Link className="button button-outline" href="/aiken-omoide-douga">サービスを詳しく見る</Link></div></aside>
      <SeoGuideLinks currentPath="/uchinoko-kinenbi-douga" />
    </InfoPage>
  );
}
