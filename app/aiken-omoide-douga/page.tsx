import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "愛犬の思い出を残す方法｜写真・動画・オリジナル絵本";
const description =
  "ペットの思い出の残し方を、写真アルバム・動画・日記・オリジナル絵本から比較。愛犬との日常を残す写真選びと、動く絵本の実例をご紹介します。";
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
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "愛犬の写真からつくる動く絵本",
      },
    ],
  },
};

const faqs = [
  [
    "写真は何枚から相談できますか？",
    "物語にしたい出来事を5つ選び、それぞれに同じ場面の写真を1枚添えてください。各物語には最大3枚まで追加できます。",
  ],
  [
    "写真スライドショーとの違いは？",
    "写真を順番に並べるのではなく、写真とエピソードから新しい絵本ページと物語文をつくり、花びら、光、水面、まばたきなどに小さな動きを加えます。",
  ],
  [
    "写真そっくりに描かれますか？",
    "完全な複製ではありません。その子の表情・毛色・特徴を参考にしながら、同じ絵本の主人公として一貫して感じられる描写を目指します。",
  ],
  [
    "完成前に絵を確認できますか？",
    "はい。動画化の前に全ページと各場面の文章をお見せし、絵本ページは合計2場面まで修正をお受けします。完成映像は合計1場面まで修正できます。",
  ],
] as const;

export default function AikenOmoideDougaPage() {
  const structuredData = createGuideStructuredData({
    path: "/aiken-omoide-douga",
    title,
    description,
    faqs,
  });
  return (
    <InfoPage
      eyebrow="MOVING STORYBOOK"
      title="愛犬の思い出を残す、わが家に合う方法。"
      lead="思い出を実写で再現するのではなく、その子らしさと、あの日の気持ちをやわらかな絵で残します。"
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
        <span>愛犬の動く絵本</span>
      </nav>
      <section>
        <h2>ペットの思い出の残し方は、見返し方で選ぶ</h2>
        <p>写真をそのまま残したいのか、その日の気持ちも伝えたいのか。愛犬との思い出は、一つの形にまとめなくても大丈夫です。元の写真や動画を保管したうえで、ご家族が開きたくなる形を選びましょう。</p>
        <div className="seo-card-grid">
          <article><strong>写真アルバム・フォトブック</strong><p>毛並みや表情を写真のまま残したい方に。日付と一言を添えると、いつの出来事か思い出しやすくなります。紙の本は手に取れますが、新しい写真は次の一冊にまとめます。</p></article>
          <article><strong>動画</strong><p>歩き方や声まで残すなら、日常の短い動画を撮っておく方法が向いています。写真しかない場面はスライドショーにもできます。元の動画も別に保存しましょう。</p></article>
          <article><strong>日記・家族からの手紙</strong><p>好きな遊び、呼び名、出会った時の気持ちは文章に。長く書く必要はありません。「今日は玄関で待っていた」だけでも、その子らしい記録になります。</p></article>
          <article><strong>オリジナルの動く絵本</strong><p>写真とエピソードを絵と物語で残す方法です。WAN MEMORYは紙の本ではなく、約40秒の映像と絵本ページ、専用ホームページをオンラインでお届けします。</p></article>
        </div>
      </section>
      <section>
        <h2>今日から残せる、三つの小さな記録</h2>
        <ol><li>いつもの散歩、寝顔、お気に入りのおもちゃを一枚ずつ撮る。</li><li>写真に日付と「なぜこの場面が好きなのか」を一言添える。</li><li>月に一度、見返したい写真を選び、端末とは別の場所にも保存する。</li></ol>
        <p>誕生日や旅行だけでなく、普段の暮らしも大切な思い出です。お別れのあとに整理する場合も、一度にまとめようとせず、今見られる一枚から始めてください。</p>
        <Link className="text-link" href="/aiken-shashin-seiri">写真の整理と保存方法を見る →</Link>
      </section>
      <section className="seo-lead-panel">
        <p>
          WAN
          MEMORYの動く絵本は、愛犬を大きく走らせたり話させたりする作品ではありません。紙の上の絵が静かに息をするような動きと、短い文章で思い出をつなぎます。
        </p>
        <ul>
          <li>水彩とガッシュで統一した絵本ページ</li>
          <li>5つの物語と場面写真から物語案を2案</li>
          <li>動画化の前に全ページと文章を確認</li>
          <li>約40秒・BGMと物語字幕つき</li>
        </ul>
      </section>
      <section>
        <h2>物語ができるまで</h2>
        <ol className="seo-step-list">
          <li>
            <span>01</span>
            <div>
              <strong>物語にしたい日を選ぶ</strong>
              <p>
                写真が残っている出来事から、5つを選びます。
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>その日の写真を添える</strong>
              <p>
                物語ごとに基準写真を1枚添え、場所、季節、しぐさ、ご家族の気持ちを伺います。
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>二つの物語案にする</strong>
              <p>
                花びらや光など、一つのモチーフで記憶をつなぐ二つのあらすじをご提案します。
              </p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <strong>絵を動かす</strong>
              <p>承認されたページに控えめな動きと文章、BGMを重ねます。</p>
            </div>
          </li>
        </ol>
      </section>
      <section>
        <h2>動く絵本に向いている思い出</h2>
        <div className="seo-card-grid">
          <article>
            <strong>はじめての出来事</strong>
            <p>家族になった春、初めての海、初めて雪を踏んだ日。</p>
          </article>
          <article>
            <strong>いつもの日常</strong>
            <p>窓辺の昼寝、帰宅を待つ時間、毎朝歩く小道。</p>
          </article>
          <article>
            <strong>家族だけが知るしぐさ</strong>
            <p>少し首をかしげる、怖いと一歩下がる、安心すると丸く眠る。</p>
          </article>
        </div>
      </section>
      <section>
        <h2>実写再現をやめた理由</h2>
        <p>
          写真にない角度や動きを実写らしく作ろうとすると、毛並み、目、しっぽ、体型が場面ごとに変わりやすくなります。絵本なら、完全な複製を競うのではなく、ご家族が感じる「この子らしさ」と物語全体の一貫性を優先できます。
        </p>
        <Link className="text-link" href="/film/moka-demo">
          モカの動くページを見る →
        </Link>
      </section>
      <section>
        <h2>実際にお届けした動く絵本を見る</h2>
        <p>ムアとだいふくの完成映像、ご家族からいただいた感想を公開しています。写真とエピソードがどんな作品になるのか、制作前の参考にご覧ください。</p>
        <Link className="text-link" href="/#reviews">完成映像とご家族のレビューを見る →</Link>
      </section>
      <section className="seo-faq">
        <h2>動く絵本についてよくある質問</h2>
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
        <p>物語がまとまっていなくても大丈夫です。</p>
        <h2>覚えていることから、最初のページへ。</h2>
        <div>
          <StartStoryLink className="button button-primary">
            物語を相談する →
          </StartStoryLink>
          <Link className="button button-outline" href="/film/moka-demo">
            動くページを見る
          </Link>
        </div>
      </aside>
      <SeoGuideLinks currentPath="/aiken-omoide-douga" />
    </InfoPage>
  );
}
