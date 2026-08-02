import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "愛犬の動く絵本に使う写真の選び方";
const description =
  "愛犬が主人公になる動く絵本のための写真準備ガイド。最初に必要な代表写真と、思い出ごとの参考写真の選び方をご案内します。";

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
    "最初に必須なのは、その子らしさが分かるお気に入りの代表写真1枚です。加えて3つの思い出ごとに、同じ出来事の写真があれば添えてください。",
  ],
  [
    "正面・全身・横向きは必要ですか？",
    "必須ではありません。絵本として描くため、実写の全角度を再現する資料より、ご家族が『この子らしい』と感じる表情を優先します。別の角度が必要な場合だけ、担当者からあとでお願いします。",
  ],
  [
    "HEIC形式も送れますか？",
    "はい。iPhoneのHEIC写真は、アップロード時に制作で扱える形式へ変換します。",
  ],
  [
    "家族と一緒の写真も送れますか？",
    "はい。人物のお顔は新しく生成せず、必要な場合だけ後ろ姿・手元・足元・シルエットなどで表現します。",
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
      title="完璧な資料より、『この子らしい』一枚を。"
      lead="動く絵本では、写真をそっくり再現するための3方向写真は必須ではありません。主人公らしさと、思い出の空気が伝わる写真を選びます。"
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
          最初に選ぶのは、その子の見た目を測るための写真ではなく、ご家族が見て「この表情が好き」と思える代表写真です。
        </p>
        <ul>
          <li>目と表情が自然に見える</li>
          <li>毛色が強いフィルターで変わっていない</li>
          <li>その子らしい耳や口元が分かる</li>
          <li>ご家族が好きな一枚である</li>
        </ul>
      </section>
      <section>
        <h2>用意する写真は二つの役割</h2>
        <ol className="seo-photo-list">
          <li>
            <span>01</span>
            <div>
              <strong>主人公を知る代表写真</strong>
              <p>
                正面でも斜めでも、座っていても構いません。いつもの目つきや口元、毛色が分かるお気に入りの1枚を選びます。
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>思い出の空気を伝える写真</strong>
              <p>
                桜の道、海辺、昼寝をした部屋など。犬が小さく写っていても、場所・季節・小物が分かれば絵本ページの大切な参考になります。
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>必要な時だけ追加する写真</strong>
              <p>
                物語に横向きや走る姿が必要なのに資料が足りない場合は、制作室から具体的な写真をお願いします。
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
            <p>顔の輪郭や耳、口元が見えない写真は代表写真に向きません。</p>
          </article>
        </div>
      </section>
      <section>
        <h2>思い出写真がない場合</h2>
        <p>
          写真が残っていない出来事も、文章からご相談いただけます。「雨上がりの公園」「初めて聞いた波の音」「お気に入りの毛布」など、場所・季節・その子の反応を教えてください。代表写真をもとに、新しい絵本の場面としてご提案します。
        </p>
      </section>
      <section>
        <h2>人物が写っている場合</h2>
        <p>
          家族と一緒に写った写真も参考資料として送れます。人物のお顔は生成・使用せず、物語に必要な場合だけ後ろ姿、手元、足元、シルエットとして表現します。写真に写る方の了解を得てからお送りください。
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
        <h2>まずは、いちばん好きな一枚から。</h2>
        <div>
          <StartStoryLink className="button button-primary">
            物語を相談する →
          </StartStoryLink>
          <Link className="button button-outline" href="/film/miru-demo">
            動くページを見る
          </Link>
        </div>
      </aside>
      <SeoGuideLinks currentPath="/dog-photo-guide" />
    </InfoPage>
  );
}
