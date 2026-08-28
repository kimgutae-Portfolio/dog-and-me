import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "愛犬の動く絵本に使う写真の選び方";
const description =
  "愛犬が主人公になる動く絵本のための写真準備ガイド。5つの物語ごとに、場面写真を迷わず選ぶ方法をご案内します。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/dog-photo-guide" },
  openGraph: {
    title: `${title}｜WAN MEMORY`,
    description,
    url: "/dog-photo-guide",
    type: "article",
    locale: "ja_JP",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "愛犬の動く絵本 写真選びガイド",
      },
    ],
  },
};

const faqs = [
  [
    "写真は最低何枚必要ですか？",
    "物語は5つです。物語ごとに写真が1枚必要なので、最低5枚をご用意ください。迷う場合は各物語3枚まで候補を送れますが、制作には担当者が選んだ1枚だけを使用します。",
  ],
  [
    "正面・全身・横向きは必要ですか？",
    "必要ありません。各物語の場面が分かる写真を優先します。正面・全身・横向きのためだけに別の写真を探していただくことはありません。",
  ],
  [
    "HEIC形式も送れますか？",
    "はい。iPhoneのHEIC写真は、アップロード時に制作で扱える形式へ変換します。",
  ],
  [
    "家族と一緒の写真も送れますか？",
    "はい。ただし完成イラストから人物はすべて除き、愛犬だけの場面として背景を再構成します。愛犬だけがはっきり写った写真が、最もその子らしく自然に仕上がります。",
  ],
] as const;

export default function DogPhotoGuidePage() {
  const structuredData = createGuideStructuredData({
    path: "/dog-photo-guide",
    title,
    description,
    faqs,
  });
  return (
    <InfoPage
      eyebrow="PHOTO GUIDE"
      title="物語ひとつに、その日の一枚を。"
      lead="正面・全身・横向きを揃える必要はありません。5つの物語それぞれに、出来事と空気がいちばん伝わる写真を1枚選びます。"
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
        <span>動く絵本の写真選び</span>
      </nav>
      <section className="seo-lead-panel">
        <p>
          写真は物語ごとに選びます。桜の道の物語なら桜の日、海の物語なら海の日の写真を1枚。これがそのページの絵と動きの基準になります。
        </p>
        <ul>
          <li>目と表情が自然に見える</li>
          <li>毛色が強いフィルターで変わっていない</li>
          <li>その子らしい耳や口元が分かる</li>
          <li>ご家族が好きな一枚である</li>
        </ul>
      </section>
      <section>
        <h2>各物語で選ぶ写真は二つの役割</h2>
        <ol className="seo-photo-list">
          <li>
            <span>01</span>
            <div>
              <strong>必須の基準写真</strong>
              <p>
                その出来事が最もよく伝わる1枚です。申込画面で最初に選んだ写真が、自動的にその物語の基準写真になります。
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>迷った時は候補を追加</strong>
              <p>
                どの写真がよいか迷った場合は、あと2枚まで候補を追加できます。担当者が確認し、制作に使う1枚を選びます。未選択の写真をAI制作へ混ぜることはありません。
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>物語同士は混ぜない</strong>
              <p>
                海の写真は海の物語へ、桜の写真は桜の物語へ。同じ写真を複数の物語に重ねて登録する必要はありません。
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section>
        <h2>避けたい写真</h2>
        <div className="seo-card-grid">
          <article>
            <strong>目を大きくする加工</strong>
            <p>主人公の表情を読み取りにくくなります。</p>
          </article>
          <article>
            <strong>毛色が変わるフィルター</strong>
            <p>暖色・寒色が強すぎる写真は本来の色が分かりません。</p>
          </article>
          <article>
            <strong>大きなぼけ・手ぶれ</strong>
            <p>出来事や愛犬の様子が読み取れない写真は基準写真に向きません。</p>
          </article>
        </div>
      </section>
      <section>
        <h2>その出来事の写真がない場合</h2>
        <p>
          制作時の迷いを減らすため、現在は各物語に写真1枚を必須としています。写真が残っている出来事の中から、物語にしたい日を5つ選んでください。
        </p>
      </section>
      <section>
        <h2>人物が写っている場合</h2>
        <p>
          家族と一緒に写った写真も送れますが、完成イラストでは人物をすべて除き、愛犬だけの場面として制作します。人物がいた場所は物を足さず、元の場所につながる自然な背景として再構成します。人物で愛犬の体が隠れている場合や、背景を大きく補う必要がある場合は、仕上がりが不自然になることがあります。その子らしさを最も活かせるのは、愛犬だけが明るくはっきり写った写真です。
        </p>
      </section>
      <section className="seo-faq">
        <h2>写真についてよくある質問</h2>
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
        <p>写真が揃っていなくても、入力途中で保存できます。</p>
        <h2>まずは、物語にしたい五日を選ぶところから。</h2>
        <div>
          <StartStoryLink className="button button-primary">
            物語を相談する →
          </StartStoryLink>
          <Link className="button button-outline" href="/film/moka-demo">
            動くページを見る
          </Link>
        </div>
      </aside>
      <SeoGuideLinks currentPath="/dog-photo-guide" />
    </InfoPage>
  );
}
