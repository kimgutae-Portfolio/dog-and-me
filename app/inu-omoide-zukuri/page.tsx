import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";
import { DEFAULT_SITE_ORIGIN } from "../lib/site";

const path = "/inu-omoide-zukuri";
const title = "犬との思い出作りアイデア10選｜何気ない毎日を大切に残す方法";
const description =
  "愛犬との思い出作りにおすすめのアイデア10選。いつもの散歩や季節の写真、誕生日、家族への言葉を無理なく記録し、写真・動画・アルバムとして残す方法を紹介します。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    title: `${title}｜WAN MEMORY`,
    description,
    url: path,
    type: "article",
    locale: "ja_JP",
    images: [
      {
        url: "/film/moka/03-storybook-bread.webp",
        width: 1672,
        height: 941,
        alt: "愛犬との日常の思い出を描いた水彩絵本",
      },
    ],
  },
};

const ideas = [
  [
    "いつもの散歩道を一緒に撮る",
    "特別な場所だけでなく、毎日曲がる角や立ち止まる木の前も、その子らしさが残る場所です。犬だけの写真に加えて、道や季節が分かる少し引いた写真も一枚撮っておきましょう。",
  ],
  [
    "同じ場所で季節ごとに写真を撮る",
    "春の桜、夏の木陰、秋の落ち葉、冬の部屋など、同じ場所で撮ると時間の重なりが見えます。無理に正面を向かせず、自然に過ごしている姿を残すだけでも十分です。",
  ],
  [
    "好きなものを記録する",
    "お気に入りのおもちゃ、よく眠る場所、好きなおやつを書き留めます。物だけでなく、遊び始める前の仕草や、名前を呼んだときの反応も短い動画にすると記憶がよみがえりやすくなります。",
  ],
  [
    "家族と一緒の日常を撮る",
    "犬だけを撮っていると、撮影しているご家族の姿が残らないことがあります。抱っこする手、一緒に歩く後ろ姿、同じ部屋でくつろぐ時間も、誰と過ごしたかが伝わる大切な記録です。",
  ],
  [
    "誕生日や、うちの子記念日を祝う",
    "豪華な飾りがなくても、毎年一枚の写真と短い言葉を残せば成長の記録になります。誕生日が分からない場合は、家族に迎えた日を記念日にする方法もあります。",
  ],
  [
    "小さなできたを残す",
    "初めて歩けた道、苦手だったことが少しできた日、シニア期に自分のペースで過ごした一日。結果だけでなく、そのとき家族がうれしかった理由も一文添えておきます。",
  ],
  [
    "声や足音を短い動画にする",
    "写真では残せない鳴き声、寝息、床を歩く足音は、数秒の動画でも大切な記録になります。撮影のために行動を促さず、普段どおりの安全な距離から残しましょう。",
  ],
  [
    "犬の目線で好きな場所を残す",
    "いつも窓の外を見る場所や、玄関で家族を待つ場所を犬の高さから撮ってみます。犬が見ていた景色と、その場所でのエピソードを一緒に残せます。",
  ],
  [
    "月に一度、ベスト写真を選ぶ",
    "写真を増やすだけでなく、月末に一枚を選び、撮影日と出来事を書きます。選ばなかった写真を消す必要はありません。見返すための入口を一枚作る感覚で続けましょう。",
  ],
  [
    "写真に家族の言葉を添える",
    "『かわいい』だけで終わらせず、その日に何があったのか、どんな仕草が好きだったのかを書きます。短い言葉でも、あとから写真を見る家族にその場面を伝えてくれます。",
  ],
] as const;

const faqs = [
  [
    "犬との思い出作りは、特別なお出かけをしないとできませんか？",
    "いいえ。散歩、食事の前、昼寝、家族の帰宅を待つ姿など、いつもの暮らしも大切な思い出になります。犬の体調と普段の生活を優先し、無理のない場面を残してください。",
  ],
  [
    "犬の写真が多すぎるときは、どう整理すればよいですか？",
    "最初からすべてを整理せず、月ごと、季節ごと、出来事ごとに見返したい写真を一枚ずつ選びます。元データは端末以外にもバックアップし、選んだ理由を短く添えると探しやすくなります。",
  ],
  [
    "シニア犬との思い出は、どのように残せばよいですか？",
    "新しい体験を増やすことより、落ち着ける場所や好きな時間を普段どおり過ごすことを大切にしてください。寝息、ゆっくり歩く姿、家族のそばで休む様子も、その子らしい記録です。",
  ],
  [
    "写真だけでもオリジナルの物語にできますか？",
    "写真に加えて、その場面の場所、季節、愛犬の仕草、ご家族が覚えていることがあると、その子らしい物語にしやすくなります。WAN MEMORYでは5つの出来事と写真を伺い、動く絵本と専用ホームページにまとめます。",
  ],
] as const;

export default function InuOmoideZukuriPage() {
  const structuredData = [
    ...createGuideStructuredData({ path, title, description, faqs }),
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${DEFAULT_SITE_ORIGIN}${path}#article`,
      headline: title,
      description,
      inLanguage: "ja-JP",
      mainEntityOfPage: `${DEFAULT_SITE_ORIGIN}${path}`,
      image: `${DEFAULT_SITE_ORIGIN}/film/moka/03-storybook-bread.webp`,
      author: {
        "@type": "Organization",
        name: "WAN MEMORY",
        url: DEFAULT_SITE_ORIGIN,
      },
      publisher: {
        "@type": "Organization",
        name: "WAN MEMORY",
        url: DEFAULT_SITE_ORIGIN,
      },
    },
  ];

  return (
    <InfoPage
      eyebrow="DOG MEMORY GUIDE"
      title="犬との思い出作りアイデア10選"
      lead="遠くへ出かけなくても、何気ない毎日の中に、その子らしい思い出はあります。愛犬に負担をかけず、家族があとで見返せる形にするヒントをご紹介します。"
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
        <span>犬との思い出作り</span>
      </nav>

      <section className="seo-lead-panel">
        <p>
          犬との思い出作りというと、旅行や記念日のような特別な体験を思い浮かべるかもしれません。でも、毎朝の散歩、窓辺の昼寝、家族を待つ姿にも、その子だけの時間が表れています。
        </p>
        <p>
          大切なのは、写真の枚数を競うことではなく「なぜこの場面を覚えていたいのか」を一言残すこと。今一緒に暮らしている愛犬にも、シニア期を過ごす愛犬にも無理のない方法から始めてみましょう。
        </p>
      </section>

      <nav className="seo-toc" aria-label="この記事の目次">
        <p>この記事の目次</p>
        <ul>
          <li><a href="#ideas">犬との思い出作りアイデア10選</a></li>
          <li><a href="#keep">写真を思い出として残す3つのコツ</a></li>
          <li><a href="#senior">シニア犬との時間を残すとき</a></li>
          <li><a href="#faq">よくある質問</a></li>
        </ul>
      </nav>

      <section id="ideas">
        <h2>今日からできる、犬との思い出作りアイデア10選</h2>
        <p>愛犬の性格や年齢、体調に合うものを一つだけ選んでください。撮影のために長く待たせたり、苦手な場所へ連れて行ったりする必要はありません。</p>
        <ol className="seo-photo-list">
          {ideas.map(([heading, body], index) => (
            <li key={heading}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{heading}</strong>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="keep">
        <h2>いつもの散歩の写真を、絵本の一ページに</h2>
        <p>WAN MEMORYの公開サンプル「モカと、五つの記憶」では、秋の散歩を写真と絵で表現しています。以下はサービス紹介用のサンプルで、お客様の実体験やレビューではありません。</p>
        <div className="guide-example-images">
          <figure><Image src="/film/moka/09-autumn-ginkgo.webp" alt="モカの公開サンプルに使われた、銀杏の散歩道の写真" width={1447} height={1087} sizes="(max-width: 640px) 90vw, 400px" /><figcaption>元の写真：秋の散歩道</figcaption></figure>
          <figure><Image src="/film/moka/04-storybook-autumn.webp" alt="銀杏色の散歩道を水彩で描いた、モカの絵本ページ" width={1672} height={941} sizes="(max-width: 640px) 90vw, 400px" /><figcaption>絵本ページ：銀杏色の散歩道</figcaption></figure>
        </div>
        <p>写真に写っている場所や季節に加えて「この道で、どんなふうに歩いていたか」を言葉にすると、残したい場面が具体的になります。写真だけでは伝わらないことは、ご家族が実際に覚えている範囲で添えてください。</p>
        <Link href="/film/moka-demo">モカの完成作品を見る →</Link>
      </section>

      <section>
        <h2>写真を「見返せる思い出」にする3つのコツ</h2>
        <div className="seo-card-grid">
          <article>
            <strong>日付と場所を残す</strong>
            <p>撮影日時だけでなく「いつもの川沿い」「家族になった日の公園」のように、ご家族が分かる場所の名前を添えます。</p>
          </article>
          <article>
            <strong>その子らしい理由を書く</strong>
            <p>何をしている写真かではなく、なぜ好きなのかを書きます。「風が吹くと必ず立ち止まった」など、家族だけが知る記憶になります。</p>
          </article>
          <article>
            <strong>別の場所にも保存する</strong>
            <p>スマートフォンだけに置かず、クラウドや外部ストレージなど別の場所にも保存します。大切な写真ほど複数の保管先を用意しましょう。</p>
          </article>
        </div>
        <p>
          写真が多くて選べない場合は、<Link href="/aiken-shashin-seiri">愛犬の写真を整理・保存する方法</Link>も参考にしてください。
        </p>
      </section>

      <section id="senior">
        <h2>シニア犬との思い出を残すときに大切なこと</h2>
        <p>
          年齢を重ねた犬には、思い出作りのための新しい体験より、安心して過ごせるいつもの時間が大切な場合があります。短い散歩、日なたで休む姿、家族の手に体を預ける時間を、愛犬のペースのまま残してください。
        </p>
        <p>
          体調が優れないときは撮影を優先せず、そばで過ごすことを選びましょう。あとから文章だけで「あの日はここで一緒に過ごした」と記録することも、十分な思い出の残し方です。
        </p>
      </section>

      <section>
        <h2>写真とエピソードを、一つの物語にする</h2>
        <p>
          写真を整理していると、家族になった日、初めてのお出かけ、いつもの散歩、好きだった場所など、時間の流れが見えてきます。出来事の違う写真を選び、それぞれに短いエピソードを添えると、アルバムや動画にもまとめやすくなります。
        </p>
        <p>
          WAN MEMORYでは、愛犬の写真と5つの思い出から、水彩で描く約40秒の動く絵本と専用ホームページを制作しています。元の写真を置き換えるものではなく、ご家族が覚えている言葉や気持ちを、もう一つの見返し方として残すサービスです。
        </p>
        <Link className="text-link" href="/film/moka-demo">完成した動く絵本と専用ページを見る →</Link>
      </section>

      <section id="faq" className="seo-faq">
        <h2>犬との思い出作りについてよくある質問</h2>
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}<span aria-hidden="true">＋</span></summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>

      <aside className="seo-cta">
        <p>特別な日だけでなく、いつもの表情も。</p>
        <h2>愛犬との5つの思い出を、動く絵本に。</h2>
        <p>完成作品を見てから、ご家族のペースで始められます。</p>
        <div>
          <Link className="button button-primary" href="/film/moka-demo">完成作品を見る →</Link>
          <StartStoryLink className="button button-outline">思い出を入力する</StartStoryLink>
        </div>
      </aside>

      <SeoGuideLinks currentPath={path} />
    </InfoPage>
  );
}
