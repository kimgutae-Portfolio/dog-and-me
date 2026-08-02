import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { LivePriceCard } from "./components/LivePriceCard";
import { MobileStickyCta } from "./components/MobileStickyCta";
import { StartStoryLink } from "./components/StartStoryLink";
import { formatYen, MEMORY_FILM_PRICING } from "./lib/pricing";
import {
  APPLICATIONS_OPEN,
  PRELAUNCH_COPY,
  PRELAUNCH_CTA,
  SITE_DESCRIPTION,
  SITE_NAME,
  BUSINESS_NAME,
  BUSINESS_OPERATOR,
  SUPPORT_EMAIL,
} from "./lib/site";
import { getRequestOrigin } from "./lib/site-server";

export const metadata: Metadata = {
  title: "愛犬が主人公になる、動く絵本制作",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const storyPages = [
  {
    number: "01",
    label: "春風から届いた手紙",
    sentence: "春の日、小さな手紙が届きました。",
    image: "/film/miru/01-spring-letter.jpg",
  },
  {
    number: "02",
    label: "桜色の旅",
    sentence: "ひとひらは、知らない青へ。",
    image: "/film/miru/02-color-journey.jpg",
  },
  {
    number: "03",
    label: "はじめての波",
    sentence: "その先で、はじめての波に出会いました。",
    image: "/film/miru/03-first-wave.jpg",
  },
] as const;

const homeFaqs = [
  [
    "どんな映像になりますか？",
    "愛犬を写真そっくりの実写として再現するのではなく、その子の特徴や表情をやわらかな水彩・ガッシュで描き、花びら、光、水、しっぽなどに小さな動きを加えた約1分の『動く絵本』です。",
  ],
  [
    "写真は何枚必要ですか？",
    "その子らしさがよく分かるお気に入りの写真1枚と、3つの思い出それぞれの参考写真をご用意ください。思い出の写真がない場合も、文章からご相談いただけます。正面・全身・横向きの3枚セットは必須ではありません。",
  ],
  [
    "写真がそのまま動くのですか？",
    "いいえ。写真とエピソードをもとに、まず一冊分の絵本ページを新しく描きます。お客様に絵と文章をご確認いただいた後、その絵に控えめな動きをつけます。",
  ],
  [
    "愛犬の顔が変わることはありますか？",
    "イラストとして描き直すため、写真との完全な一致は保証できません。ただし、完成した全ページを動画化の前にお見せし、その子らしく感じられるかをご確認いただきます。",
  ],
  [
    "物語案2案とは何ですか？",
    "同じ3つの思い出から、出来事をつなぐモチーフや物語の運び方が異なる2つのあらすじをご提案します。お好きな1案を選んでから料金をご案内します。",
  ],
  [
    "ナレーションは入りますか？",
    "標準仕様はナレーションなしです。短い物語の文章を各場面に入れ、BGMと小さな環境音で、声に出しても静かに読んでも楽しめる作品に仕上げます。",
  ],
  [
    "人が写っている写真も送れますか？",
    "はい。人物のお顔は新しく生成せず、必要な場合だけ後ろ姿・手元・足元・シルエットなど、お顔が分からない形で表現します。",
  ],
  [
    "支払いはいつですか？",
    "相談フォームの送信時には料金は発生しません。写真とお話を確認し、2つの物語案から1案を選んでいただいた後、確定料金・納期・キャンセル条件とともにカード決済をご案内します。",
  ],
  [
    "完成までどのくらいかかりますか？",
    "必要な素材とお支払いの確認後、通常10〜14営業日が目安です。絵本ページの確認や修正期間によって前後する場合があります。",
  ],
  [
    "モニター価格とは何ですか？",
    `初期${MEMORY_FILM_PRICING.launchLimit}組限定で、動く絵本の制作工程と品質を確認するための価格 ¥${formatYen(MEMORY_FILM_PRICING.launchPrice)}（税込）です。終了後は通常価格 ¥${formatYen(MEMORY_FILM_PRICING.regularPrice)}（税込）になります。`,
  ],
] as const;

export default async function Home() {
  const origin = await getRequestOrigin();
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      url: origin,
      name: SITE_NAME,
      alternateName: "ワンメモリー",
      description: SITE_DESCRIPTION,
      inLanguage: "ja-JP",
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: BUSINESS_NAME,
      legalName: BUSINESS_OPERATOR,
      url: origin,
      email: SUPPORT_EMAIL,
      description: SITE_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${origin}/#moving-storybook-service`,
      name: "愛犬の動く絵本制作",
      serviceType: "愛犬の写真からつくるオーダーメイド動画絵本",
      description: SITE_DESCRIPTION,
      url: `${origin}/#plans`,
      image: `${origin}/og.png`,
      provider: { "@id": `${origin}/#organization` },
      areaServed: { "@type": "Country", name: "日本" },
      availableLanguage: "日本語",
      offers: {
        "@type": "Offer",
        price: MEMORY_FILM_PRICING.launchPrice,
        priceCurrency: "JPY",
        availability: "https://schema.org/InStock",
        url: `${origin}/#plans`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: homeFaqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];

  return (
    <main className="storybook-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <SiteHeader />
      <MobileStickyCta />

      <section className="storybook-hero" aria-labelledby="hero-title">
        <video
          className="storybook-hero-video"
          autoPlay
          muted
          loop
          playsInline
          poster="/film/miru/01-spring-letter.jpg"
          aria-hidden="true"
        >
          <source src="/film/miru/spring-letter.mp4" type="video/mp4" />
        </video>
        <div className="storybook-hero-wash" aria-hidden="true" />
        <div className="shell storybook-hero-copy">
          <p className="eyebrow">A MOVING STORYBOOK FOR YOUR DOG</p>
          <h1 id="hero-title">
            うちの子が主人公になる、
            <br />
            動くものがたり。
          </h1>
          <p>
            お気に入りの写真と、あなたが覚えている三つの出来事から。
            <br className="desktop-only" />
            その子だけの絵を描き、小さな動きと文章を重ねて、一冊のような映像にします。
          </p>
          <div className="storybook-hero-actions">
            {APPLICATIONS_OPEN ? (
              <StartStoryLink className="button button-primary">
                物語をつくる <span aria-hidden="true">→</span>
              </StartStoryLink>
            ) : (
              <span className="button button-prelaunch" aria-disabled="true">
                {PRELAUNCH_CTA}
              </span>
            )}
            <Link className="text-link" href="/film/miru-demo">
              動くページを見る <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <span className="storybook-hero-note">
            PICTURE BOOK 01 · 春風から届いた手紙
          </span>
        </div>
      </section>

      <section className="storybook-intro section" id="about">
        <div className="shell storybook-intro-grid">
          <div>
            <p className="eyebrow">NOT A RE-CREATION, A NEW STORY</p>
            <h2>
              写真を再現するのではなく、
              <br />
              記憶から物語を描く。
            </h2>
          </div>
          <div>
            <p>
              毛並みやしっぽを実写のように完璧に再現することより、ご家族が知っている表情や、あの日の空気を一冊の絵本として残すことを大切にします。
            </p>
            <p>
              一場面ずつ同じ画材と色で描き、動画では犬を大きく演技させません。花びら、水面、光、まばたき。ページがそっと息をするような動きに整えます。
            </p>
            <ul>
              <li>やわらかな水彩・ガッシュ</li>
              <li>物語をつなぐ短い文章</li>
              <li>人の目で一場面ずつ確認</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="storybook-preview section" id="story-preview">
        <div className="shell">
          <div className="storybook-heading">
            <div>
              <p className="eyebrow">MIRU AND A PETAL OF SPRING</p>
              <h2>
                一枚の花びらが、
                <br />
                三つの記憶をつないでいく。
              </h2>
            </div>
            <p>
              ミルのテストストーリー「ひとひらの春」より。
              <br />
              絵・動き・文章を同じ世界観でつなぎます。
            </p>
          </div>
          <ol className="storybook-page-grid">
            {storyPages.map((page, index) => (
              <li key={page.number} className={index === 0 ? "featured" : ""}>
                <figure>
                  <img
                    src={page.image}
                    alt={`動く絵本「${page.label}」の場面`}
                  />
                  <figcaption>
                    <span>{page.number}</span>
                    <strong>{page.label}</strong>
                  </figcaption>
                </figure>
                <blockquote>{page.sentence}</blockquote>
              </li>
            ))}
          </ol>
          <Link
            className="button button-outline storybook-preview-link"
            href="/film/miru-demo"
          >
            ミルの動くページを見る →
          </Link>
        </div>
      </section>

      <section className="storybook-method section" id="memory-story">
        <div className="shell">
          <div className="storybook-heading light">
            <div>
              <p className="eyebrow">HOW A MEMORY BECOMES A BOOK</p>
              <h2>
                あなたが渡すのは、
                <br />
                写真と、覚えていること。
              </h2>
            </div>
            <p>
              映像AIの指示を書く必要はありません。
              <br />
              物語と絵と動きは、こちらで一つに整えます。
            </p>
          </div>
          <ol className="storybook-method-grid">
            <li>
              <span>01</span>
              <strong>その子らしい一枚</strong>
              <p>
                顔・全身・横向きの3枚セットは不要です。まずは「この子らしい」と思えるお気に入りの写真を選びます。
              </p>
            </li>
            <li>
              <span>02</span>
              <strong>三つの思い出</strong>
              <p>
                初めての海、いつもの昼寝、忘れられない春。場所やしぐさ、その時の気持ちを聞かせてください。
              </p>
            </li>
            <li>
              <span>03</span>
              <strong>二つの物語案</strong>
              <p>
                単なる回想の並びではなく、花びらや光など一つのモチーフで記憶をつなぐ2案をご提案します。
              </p>
            </li>
            <li>
              <span>04</span>
              <strong>動く絵本へ</strong>
              <p>
                承認いただいた絵本ページに小さな動きをつけ、文章・BGMとともに約1分の作品へ仕上げます。
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="storybook-directions section-tight">
        <div className="shell">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">TWO STORY DIRECTIONS</p>
              <h2>同じ思い出から、二つの物語。</h2>
            </div>
            <p>お支払いの前に、心に近い1案を選べます。</p>
          </div>
          <div className="storybook-direction-grid">
            <article>
              <span>STORY A</span>
              <h3>ひとひらの春</h3>
              <p>
                一枚の花びらが案内人になり、春の散歩道から初めての海、眠る部屋まで旅をする物語。
              </p>
              <ol>
                <li>春風から届いた手紙</li>
                <li>桜色の旅</li>
                <li>はじめての波</li>
                <li>夢の中の宝物</li>
              </ol>
            </article>
            <article>
              <span>STORY B</span>
              <h3>ミルの、はじめて図鑑</h3>
              <p>
                出会った色、音、においを一ページずつ集め、最後に「わたしの宝物図鑑」が完成する物語。
              </p>
              <ol>
                <li>桜色をみつける</li>
                <li>水の音をおぼえる</li>
                <li>海の青をひらく</li>
                <li>今日の宝物をしまう</li>
              </ol>
            </article>
          </div>
        </div>
      </section>

      <section className="process-section section" id="flow">
        <div className="shell">
          <p className="eyebrow">FROM PHOTO TO STORYBOOK</p>
          <div className="process-head">
            <h2>ご相談からお届けまで。</h2>
            <p>制作室で、物語・絵本ページ・完成映像を順番に確認できます。</p>
          </div>
          <ol className="process-list">
            {[
              [
                "01",
                "写真と三つの思い出を送る",
                "お気に入りの代表写真と、物語にしたい出来事を登録します。途中保存もできます。",
              ],
              [
                "02",
                "二つの物語案を受け取る",
                "担当者が写真とお話を読み、つながり方の異なる二つのあらすじをご提案します。",
              ],
              [
                "03",
                "1案を選び、料金を確認する",
                "選んだ物語、確定料金、予定納期、キャンセル条件を確認してからカードでお支払いいただきます。",
              ],
              [
                "04",
                "絵本ページと文章を確認する",
                "全場面の絵と、その場面に入る短い文章を先にお見せします。調整は2回まで可能です。",
              ],
              [
                "05",
                "小さな動きを加える",
                "承認された絵をもとに、犬の姿を安定させながら環境と表情を控えめに動かします。",
              ],
              [
                "06",
                "完成前の作品を確認する",
                "BGMと文章を含む約1分の映像をご確認いただき、修正を2回までお受けします。",
              ],
              [
                "07",
                "専用ページで受け取る",
                "完成した動く絵本と写真を、その子だけの専用ページへお届けします。",
              ],
            ].map(([number, title, copy]) => (
              <li key={number}>
                <span className="process-number">{number}</span>
                <div className="process-rule" aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pricing-section section" id="plans">
        <div className="shell">
          <div className="pricing-heading">
            <div>
              <p className="eyebrow">ONE STORYBOOK PLAN</p>
              <h2>物語から、完成ページまで。</h2>
            </div>
            <p>二つの物語案、絵本ページ、約1分の映像、専用サイトを含みます。</p>
          </div>
          <div className="pricing-grid">
            <LivePriceCard />
          </div>
        </div>
      </section>

      <section className="faq-section section" id="faq">
        <div className="shell faq-grid">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2>よくあるご質問</h2>
            <p className="faq-lead">
              写真が少なくても、まだ物語がまとまっていなくても大丈夫です。
            </p>
          </div>
          <div className="faq-list">
            {homeFaqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">＋</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta storybook-final-cta">
        <div className="shell final-cta-inner">
          <p className="eyebrow light">OPEN THE FIRST PAGE</p>
          <h2>
            その子の物語を、
            <br />
            一ページ目から。
          </h2>
          <p>
            {APPLICATIONS_OPEN
              ? `先着${MEMORY_FILM_PRICING.launchLimit}組は ¥${formatYen(MEMORY_FILM_PRICING.launchPrice)}（税込）。相談時点では料金は発生しません。`
              : PRELAUNCH_COPY}
          </p>
          {APPLICATIONS_OPEN ? (
            <StartStoryLink className="button button-cream">
              物語づくりを始める →
            </StartStoryLink>
          ) : (
            <span
              className="button button-prelaunch button-prelaunch-light"
              aria-disabled="true"
            >
              {PRELAUNCH_CTA}
            </span>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
