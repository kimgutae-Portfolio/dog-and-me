import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "うちの子記念日を動く絵本に";
const description =
  "愛犬が家族になった日から今までの写真とエピソードを、その子が主人公になる約1分の動く絵本へ。";
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/uchinoko-kinenbi-douga" },
  openGraph: {
    title: `${title}｜WAN MEMORY`,
    description,
    url: "/uchinoko-kinenbi-douga",
    type: "website",
    locale: "ja_JP",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "うちの子記念日の動く絵本",
      },
    ],
  },
};
const faqs = [
  [
    "記念日の正確な日付が分かりません",
    "季節や当時の年齢など、覚えている範囲で大丈夫です。分からない事実を決めつけず、感情や季節の移ろいとして描きます。",
  ],
  [
    "子犬の頃と今で姿が違います",
    "成長そのものを物語にできます。各時期の写真を思い出に添え、同じ主人公の時間の変化として描き分けます。",
  ],
  [
    "記念日当日の写真がありません",
    "問題ありません。家族になった頃、好きになった場所、今の日常という三つの記憶から物語をご提案できます。",
  ],
] as const;

export default function UchinokoKinenbiPage() {
  const structuredData = createGuideStructuredData({
    path: "/uchinoko-kinenbi-douga",
    title,
    description,
    faqs,
  });
  return (
    <InfoPage
      eyebrow="ANNIVERSARY STORYBOOK"
      title="家族になった日を、物語のはじまりに。"
      lead="小さかった頃の不安そうな顔も、今の安心した寝顔も。一年ごとの変化を、一冊のような動く絵本に残します。"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <nav className="seo-breadcrumb" aria-label="パンくずリスト">
        <Link href="/">WAN MEMORY</Link>
        <span aria-hidden="true">/</span>
        <span>うちの子記念日の動く絵本</span>
      </nav>
      <section className="seo-lead-panel">
        <p>
          記念日は、ケーキや飾り付けだけの日ではありません。初めて家に来た時、安心して眠った夜、名前を呼ぶと振り向いた日。そこまでの時間すべてが、そのご家族だけの物語です。
        </p>
      </section>
      <section>
        <h2>物語の構成例</h2>
        <ol className="seo-step-list">
          <li>
            <span>01</span>
            <div>
              <strong>小さな来訪者</strong>
              <p>家族になった日の写真と、その時に感じたことから始めます。</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>家の音を覚える</strong>
              <p>
                お気に入りの場所や、ご家族の生活に慣れていく時間を描きます。
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>一緒に見つけた季節</strong>
              <p>散歩、海、雪など、初めてを重ねた記憶をつなぎます。</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <strong>今日も同じ家で</strong>
              <p>今の表情と、ご家族からの短い手紙で物語を閉じます。</p>
            </div>
          </li>
        </ol>
      </section>
      <section>
        <h2>写真の選び方</h2>
        <div className="seo-card-grid">
          <article>
            <strong>家族になった頃</strong>
            <p>小さかった姿や、最初に撮った一枚。</p>
          </article>
          <article>
            <strong>初めての出来事</strong>
            <p>散歩、旅行、季節など、心に残る場面。</p>
          </article>
          <article>
            <strong>今のお気に入り</strong>
            <p>ご家族が「この子らしい」と感じる現在の表情。</p>
          </article>
        </div>
        <Link className="text-link" href="/dog-photo-guide">
          写真選びを詳しく見る →
        </Link>
      </section>
      <section>
        <h2>完成後も、絵本を開ける場所</h2>
        <p>
          約1分の動く絵本に加え、写真とメッセージをまとめる専用ページもプランに含まれます。検索結果には表示されず、専用URLから何度でも物語を開けます。
        </p>
        <Link className="text-link" href="/film/miru-demo">
          完成ページの表現を見る →
        </Link>
      </section>
      <section className="seo-faq">
        <h2>うちの子記念日の物語について</h2>
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <span aria-hidden="true">＋</span>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
      <aside className="seo-cta">
        <p>次の記念日に間に合う納期をご案内します。</p>
        <h2>家族になった日から、物語を始める。</h2>
        <div>
          <StartStoryLink className="button button-primary">
            制作を相談する →
          </StartStoryLink>
          <Link className="button button-outline" href="/aiken-omoide-douga">
            動く絵本について見る
          </Link>
        </div>
      </aside>
      <SeoGuideLinks currentPath="/uchinoko-kinenbi-douga" />
    </InfoPage>
  );
}
