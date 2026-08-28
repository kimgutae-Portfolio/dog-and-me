import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "愛犬の写真を動画にする方法";
const description =
  "スマホに残る愛犬の写真を、見返したくなる思い出動画にする方法を解説。写真選び、エピソード、構成、音楽と文字のまとめ方をご紹介します。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/aiken-shashin-douga" },
  openGraph: {
    title: `${title}｜WAN MEMORY`,
    description,
    url: "/aiken-shashin-douga",
    type: "article",
    locale: "ja_JP",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "愛犬の写真を思い出動画にする方法",
      },
    ],
  },
};

const faqs = [
  [
    "愛犬の思い出動画には何枚くらい写真が必要ですか？",
    "短い動画なら5〜15枚ほどでも作れます。枚数を増やすことより、家族になった日、いつもの散歩、好きな場所など、役割の異なる写真を選ぶことが大切です。",
  ],
  [
    "縦向きと横向きの写真が混ざっていても大丈夫ですか？",
    "問題ありません。余白の使い方や切り抜き位置を写真ごとに調整すれば、一つの動画にまとめられます。顔や耳、しっぽが画面の端に近い写真は、無理に大きく切り取らないようにします。",
  ],
  [
    "写真が古かったり、画質が低かったりしても使えますか？",
    "思い出が伝わる写真なら候補にできます。小さく表示する、背景として使う、別の鮮明な写真と組み合わせるなど、画質に合わせて役割を変えると自然にまとまります。",
  ],
  [
    "亡くなった愛犬の写真でも動画にできますか？",
    "はい。無理に明るい演出を加えず、日常のしぐさやご家族の言葉を中心に、穏やかに思い出を振り返る構成にもできます。",
  ],
] as const;

export default function AikenShashinDougaPage() {
  const structuredData = createGuideStructuredData({
    path: "/aiken-shashin-douga",
    title,
    description,
    faqs,
  });

  return (
    <InfoPage
      eyebrow="PHOTO TO MOVIE GUIDE"
      title="愛犬の写真を、思い出が伝わる動画に。"
      lead="写真をたくさん並べるだけではなく、その日の空気や、ご家族だけが知るしぐさを言葉と一緒に残す方法をご紹介します。"
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
        <span>愛犬の写真を動画にする方法</span>
      </nav>

      <section className="seo-lead-panel">
        <p>
          スマホに写真はたくさんあるのに、見返すのはいつも同じ数枚。そんな時は、すべてを使おうとせず、残したい出来事を先に選ぶと、その子らしい動画にまとまります。
        </p>
        <ul>
          <li>写真の枚数より、残したい出来事を決める</li>
          <li>一枚ごとに短いエピソードを添える</li>
          <li>動きや文字を加えすぎず、表情を主役にする</li>
          <li>完成後も見返しやすい長さと保存方法を選ぶ</li>
        </ul>
      </section>

      <section>
        <h2>愛犬の写真を動画にする三つの方法</h2>
        <div className="seo-card-grid">
          <article>
            <strong>写真スライドショー</strong>
            <p>
              写真を時系列に並べ、音楽と短い文字を添える方法です。自分で作りやすく、たくさんの写真を残したい時に向いています。
            </p>
          </article>
          <article>
            <strong>写真そのものを動かす</strong>
            <p>
              まばたきや顔の動きを加える表現です。短い一場面には向きますが、元の表情や体型が変わらないか確認が必要です。
            </p>
          </article>
          <article>
            <strong>絵と物語に描き直す</strong>
            <p>
              写真とエピソードから絵本の場面を作り、小さな動きと文章を重ねます。出来事の空気まで残したい時に向いています。
            </p>
          </article>
        </div>
      </section>

      <section>
        <h2>思い出動画を作る五つの手順</h2>
        <ol className="seo-step-list">
          <li>
            <span>01</span>
            <div>
              <strong>動画を作る目的を決める</strong>
              <p>
                誕生日、うちの子記念日、成長記録、日常の記録など、見返したい日の意味を一つ決めます。
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>出来事を三つから五つ選ぶ</strong>
              <p>
                家族になった日、好きな散歩道、安心して眠る場所など、違う表情が伝わる出来事を選びます。
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>出来事ごとに写真を選ぶ</strong>
              <p>
                画質の良さだけでなく、「この子らしい」と感じる目や耳、口元、しぐさが見える写真を優先します。
              </p>
              <Link className="text-link" href="/dog-photo-guide">
                写真選びを詳しく見る →
              </Link>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <strong>短い言葉を添える</strong>
              <p>
                場所や日付の説明だけでなく、その時に感じたことや、家族だけが知る小さな習慣を一文にします。
              </p>
            </div>
          </li>
          <li>
            <span>05</span>
            <div>
              <strong>音楽と動きを控えめに重ねる</strong>
              <p>
                写真の切り替えを急がず、文字を読み終えられる間を取ります。演出より愛犬の表情が先に目に入るバランスが大切です。
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section>
        <h2>作る前に決めておきたいこと</h2>
        <div className="seo-card-grid">
          <article>
            <strong>動画の長さ</strong>
            <p>
              SNS用なら短く、家族で見返す記録なら一場面ずつ余白を取ります。長くするより、残したい場面を絞る方が伝わります。
            </p>
          </article>
          <article>
            <strong>見る人</strong>
            <p>
              自分だけで見るのか、家族に贈るのか、SNSで公開するのかによって、名前や日付、写真の選び方が変わります。
            </p>
          </article>
          <article>
            <strong>保存する場所</strong>
            <p>
              動画ファイルだけでなく、元写真と文章も別に保管します。クラウドと端末など、二か所に残すと安心です。
            </p>
          </article>
        </div>
      </section>

      <section>
        <h2>写真だけでは残しにくいもの</h2>
        <p>
          写真には表情が残りますが、名前を呼んだ時の反応、帰宅を待つ場所、少し苦手だった音までは写らないことがあります。短いエピソードを一緒に書いておくと、数年後に見返した時、その日の記憶まで戻りやすくなります。
        </p>
        <Link className="text-link" href="/aiken-omoide-douga">
          写真とエピソードから作る動く絵本を見る →
        </Link>
      </section>

      <section className="seo-faq">
        <h2>愛犬の思い出動画についてよくある質問</h2>
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
        <p>写真とエピソードから、愛犬だけの物語をご提案します。</p>
        <h2>思い出を選ぶところから、相談できます。</h2>
        <div>
          <StartStoryLink className="button button-primary">
            動く絵本を相談する →
          </StartStoryLink>
          <Link className="button button-outline" href="/film/moka-demo">
            完成例を見る
          </Link>
        </div>
      </aside>

      <SeoGuideLinks currentPath="/aiken-shashin-douga" />
    </InfoPage>
  );
}
