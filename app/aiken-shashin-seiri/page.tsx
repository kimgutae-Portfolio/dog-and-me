import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const title = "愛犬の写真を整理・保存する方法";
const description =
  "スマホに増え続ける愛犬の写真を、無理なく整理して安全に残す方法を解説。写真の選び方、アルバム名、バックアップ、思い出の言葉の残し方をご紹介します。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/aiken-shashin-seiri" },
  openGraph: {
    title: `${title}｜WAN MEMORY`,
    description,
    url: "/aiken-shashin-seiri",
    type: "article",
    locale: "ja_JP",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "愛犬の写真を整理して保存する方法",
      },
    ],
  },
};

const faqs = [
  [
    "愛犬の写真は何枚くらい残せばよいですか？",
    "決まった枚数はありません。似た写真をすべて消すより、表情やしぐさが少しずつ違う写真は残し、ピンぼけや誤撮影など明らかに不要なものだけを整理すると続けやすくなります。",
  ],
  [
    "写真は日付と出来事のどちらで分けるとよいですか？",
    "普段は年月で自動整理し、特に残したい写真だけを『家族になった日』『初めての旅行』『いつもの散歩道』など出来事別のアルバムに追加する方法がおすすめです。",
  ],
  [
    "スマホだけに保存しても大丈夫ですか？",
    "故障や紛失に備え、スマホ以外にも一つ保存先を用意してください。クラウドと外付けストレージなど、異なる二か所に残すと安心です。",
  ],
  [
    "写真に言葉も一緒に残す方法はありますか？",
    "アルバム名や写真の説明欄に、場所、季節、その時のしぐさ、ご家族が感じたことを一文だけ書きます。長い日記にしなくても、後から見返す時の大切な手がかりになります。",
  ],
] as const;

export default function AikenShashinSeiriPage() {
  const structuredData = createGuideStructuredData({
    path: "/aiken-shashin-seiri",
    title,
    description,
    faqs,
  });

  return (
    <InfoPage
      eyebrow="DOG PHOTO ORGANIZING GUIDE"
      title="増え続ける愛犬の写真を、無理なく整理する。"
      lead="全部を完璧に分類しなくても大丈夫です。見返したい写真と、その日の記憶に戻れる小さな言葉を残す方法をご紹介します。"
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
        <span>愛犬の写真を整理・保存する方法</span>
      </nav>

      <section className="seo-lead-panel">
        <p>
          愛犬の写真は、似ているようで一枚ずつ表情が違います。そのため「いつか整理しよう」と思うほど、消す写真を選べなくなりがちです。最初から完璧を目指さず、見つけやすくする整理と、失わないための保存を分けて考えます。
        </p>
        <ul>
          <li>すべての写真を細かく分類しない</li>
          <li>残したい出来事だけアルバムにまとめる</li>
          <li>写真と一緒に短い言葉を残す</li>
          <li>スマホ以外にも一つ保存先を用意する</li>
        </ul>
      </section>

      <section>
        <h2>整理の目的は「減らす」より「見つけられる」こと</h2>
        <p>
          写真整理というと、似た写真を一枚に絞る作業を思い浮かべます。しかし、愛犬の写真は耳の向きや目線、口元の違いにも大切な記憶があります。無理に枚数を減らすのではなく、残したい写真へすぐ戻れる状態を目指します。
        </p>
        <div className="seo-card-grid">
          <article>
            <strong>日常の表情</strong>
            <p>昼寝、食事を待つ顔、窓の外を見る姿など、その子らしい普段の写真。</p>
          </article>
          <article>
            <strong>節目の出来事</strong>
            <p>家族になった日、誕生日、旅行、季節の行事など、時間の流れが分かる写真。</p>
          </article>
          <article>
            <strong>家族だけが知るしぐさ</strong>
            <p>首をかしげる、安心すると丸くなるなど、思い出を呼び戻してくれる写真。</p>
          </article>
        </div>
      </section>

      <section>
        <h2>愛犬の写真を整理する五つの手順</h2>
        <ol className="seo-step-list">
          <li>
            <span>01</span>
            <div>
              <strong>写真を一か所で見られるようにする</strong>
              <p>
                家族から送られた写真や古い端末の写真を、まず同じ写真アプリや保存先から確認できる状態にします。移動後すぐに元データを消さず、正しく保存されたことを確かめます。
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>明らかに不要な写真だけ整理する</strong>
              <p>
                真っ暗な写真、誤って撮った床、同じ瞬間の完全な重複など、迷わず判断できるものだけを対象にします。迷う写真は残して構いません。
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>大切な出来事のアルバムを作る</strong>
              <p>
                すべてを分類せず、後から見返したい出来事だけをアルバムに追加します。写真をコピーするのではなく、写真アプリのアルバム機能を使うと容量を増やさず整理できます。
              </p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <strong>一つの出来事に一文を添える</strong>
              <p>
                「初めて海を見て、一歩だけ後ろに下がった日」のように、写真だけでは分からないしぐさや気持ちを書きます。
              </p>
            </div>
          </li>
          <li>
            <span>05</span>
            <div>
              <strong>二か所に保存する</strong>
              <p>
                スマホとクラウド、またはクラウドと外付けストレージなど、一方に問題が起きても残る組み合わせを選びます。保存できているか定期的に開いて確認します。
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section>
        <h2>迷わないアルバム名の付け方</h2>
        <p>
          日付だけでは内容を思い出しにくいため、年月と出来事を組み合わせます。検索しやすく、家族にも伝わる短い名前がおすすめです。
        </p>
        <div className="seo-card-grid">
          <article>
            <strong>2024-04 家族になった春</strong>
            <p>迎えた頃の写真と、初めて安心して眠った日の記録。</p>
          </article>
          <article>
            <strong>2025-08 初めての海</strong>
            <p>旅行写真の中から、愛犬が写る場面だけをまとめるアルバム。</p>
          </article>
          <article>
            <strong>いつもの場所・しぐさ</strong>
            <p>窓辺、散歩道、寝顔など、年月を越えて追加していくアルバム。</p>
          </article>
        </div>
      </section>

      <section>
        <h2>一度に全部やらないための15分整理</h2>
        <p>
          一年分をまとめて整理しようとすると続きません。月に一度だけ15分を取り、直近の写真から「今月の好きな5枚」を選びます。選んだ写真を一つのアルバムに追加するだけでも、一年後には見返しやすい60枚が残ります。
        </p>
      </section>

      <section>
        <h2>写真から物語を残したい時は</h2>
        <p>
          写真を整理していると、その日の音や季節、愛犬のしぐさまで思い出す一枚が見つかります。出来事の異なる写真を五枚選び、それぞれに短いエピソードを添えると、思い出動画や絵本の構成にもつなげられます。
        </p>
        <div>
          <Link className="text-link" href="/aiken-shashin-douga">
            愛犬の写真を動画にする方法を見る →
          </Link>
        </div>
        <div>
          <Link className="text-link" href="/dog-photo-guide">
            動く絵本に使う写真の選び方を見る →
          </Link>
        </div>
      </section>

      <section className="seo-faq">
        <h2>愛犬の写真整理についてよくある質問</h2>
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
        <p>残したい五つの出来事から、愛犬だけの物語をご提案します。</p>
        <h2>写真と一緒に、その日の気持ちも残す。</h2>
        <div>
          <StartStoryLink className="button button-primary">
            動く絵本を相談する →
          </StartStoryLink>
          <Link className="button button-outline" href="/film/moka-demo">
            完成例を見る
          </Link>
        </div>
      </aside>

      <SeoGuideLinks currentPath="/aiken-shashin-seiri" />
    </InfoPage>
  );
}
