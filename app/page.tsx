import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { LivePriceCard } from "./components/LivePriceCard";
import { MobileStickyCta } from "./components/MobileStickyCta";
import { StartStoryLink } from "./components/StartStoryLink";
import { HomeStoryMotion } from "./components/HomeStoryMotion";
import { MiruBeforeAfter } from "./components/MiruBeforeAfter";
import { formatYen, MEMORY_FILM_PRICING } from "./lib/pricing";
import {
  APPLICATIONS_OPEN,
  PRELAUNCH_COPY,
  PRELAUNCH_CTA,
  PRELAUNCH_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  BUSINESS_NAME,
  BUSINESS_OPERATOR,
  SUPPORT_EMAIL,
} from "./lib/site";
import { getRequestOrigin } from "./lib/site-server";

// `absolute` because the root layout's title template only applies to child
// segments — a bare string here would render without the brand name, unlike
// every other page on the site.
export const metadata: Metadata = {
  title: { absolute: `愛犬が主人公になる、動く絵本制作｜${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const storyPages = [
  {
    number: "01",
    label: "雨音を待つ玄関",
    sentence: "雨の日も、扉の向こうを静かに待っていた。",
    image: "/film/moka/01-storybook-rain.webp",
    original: "/film/moka/06-rainy-entryway.webp",
  },
  {
    number: "02",
    label: "はじめての電車旅",
    sentence: "小さな駅で、知らない景色が動きはじめた。",
    image: "/film/moka/02-storybook-train.webp",
    original: "/film/moka/07-first-train-trip.webp",
  },
  {
    number: "03",
    label: "パンの香る朝",
    sentence: "いつもの朝には、好きな匂いとまなざしがある。",
    image: "/film/moka/03-storybook-bread.webp",
    original: "/film/moka/08-bread-morning.webp",
  },
  {
    number: "04",
    label: "銀杏色の散歩道",
    sentence: "足もといっぱいの秋が、歩くたびに揺れた。",
    image: "/film/moka/04-storybook-autumn.webp",
    original: "/film/moka/09-autumn-ginkgo.webp",
  },
  {
    number: "05",
    label: "灯りを眺める夕べ",
    sentence: "一日の終わりを、やわらかな灯りと分け合った。",
    image: "/film/moka/05-storybook-lantern.webp",
    original: "/film/moka/10-lantern-evening.webp",
  },
] as const;

const homeFaqs = [
  [
    "どんな映像になりますか？",
    "愛犬を写真そっくりの実写として再現するのではなく、その子の特徴や表情をやわらかな水彩・ガッシュで描きます。5つの物語を各5秒で制作し、花びら、光、水、しっぽなどに小さな動きを加えて、文章とBGMを含む約40秒の『動く絵本』に仕上げます。",
  ],
  [
    "写真は何枚必要ですか？",
    "物語にしたい思い出を5つ選び、それぞれに同じ場面の写真を1枚ご用意ください。別の表情や背景を補いたい物語だけ、写真を最大3枚まで追加できます。正面・全身・横向きのセットは必要ありません。",
  ],
  [
    "送った写真は変更できますか？",
    "運営者がSTORY SOURCE REVIEWで物語と写真を承認するまでは、制作室から写真を追加・削除できます。承認後に変更が必要になった場合も、担当者が個別に変更を許可すると、決済状況にかかわらず制作室から再び編集できます。変更後は担当者が写真を再確認します。",
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
    "お預かりした5つの思い出から、出来事をつなぐモチーフや物語の運び方が異なる2つのあらすじをご提案します。お好きな1案を選んでから料金をご案内します。",
  ],
  [
    "ナレーションは入りますか？",
    "標準仕様はナレーションなしです。短い物語の文章を各場面に入れ、BGMと小さな環境音で、声に出しても静かに読んでも楽しめる作品に仕上げます。",
  ],
  [
    "人が写っている写真も送れますか？",
    "はい。ただし完成イラストでは人物をすべて除き、愛犬だけの場面として背景を再構成します。人物で愛犬が隠れている写真は不自然になる場合があるため、愛犬だけがはっきり写った写真を最もおすすめします。",
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
  [
    "専用ものがたりサイトは、いつまで見られますか？",
    "公開期限は設けておらず、追加の月額料金もありません。専用URLからいつでも見返せます。将来、新しい機能や別サービスが加わる場合も、現在お届けする専用サイトの閲覧はそのまま続けられます。",
  ],
  [
    "完成後も写真を追加できますか？",
    "はい。専用サイトのアルバムには、完成後の新しい日々もいつでも追加できます。写真の枚数を気にせず続けられるよう、30枚ずつ軽く読み込みます。写真は1枚20MBまで、一度に50枚まで追加できます。",
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
      ...(APPLICATIONS_OPEN
        ? {
            offers: {
              "@type": "Offer",
              price: MEMORY_FILM_PRICING.launchPrice,
              priceCurrency: "JPY",
              availability: "https://schema.org/InStock",
              url: `${origin}/#plans`,
            },
          }
        : {}),
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
      <HomeStoryMotion />

      <section className="storybook-hero" aria-labelledby="hero-title">
        <Image
          className="storybook-hero-image"
          src="/hero-owner-dog-rainy-home.png"
          alt=""
          fill
          priority
          sizes="100vw"
          aria-hidden="true"
        />
        <div className="storybook-hero-wash" aria-hidden="true" />
        <div className="shell storybook-hero-copy">
          {!APPLICATIONS_OPEN && (
            <aside className="prelaunch-status" role="status">
              <span>COMING SOON</span>
              <strong>{PRELAUNCH_TITLE}</strong>
              <p>{PRELAUNCH_COPY}</p>
            </aside>
          )}
          <p className="eyebrow">A MOVING STORYBOOK FOR YOUR DOG</p>
          <h1 id="hero-title">
            うちの子が主人公になる、
            <br />
            動くものがたり。
          </h1>
          <p>
            お気に入りの写真と、あなたが覚えている五つの出来事から。
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
            <Link className="text-link" href="/film/moka-demo">
              モカの完成作品を見る <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <span className="storybook-hero-note">
            STORYBOOK SAMPLE · モカと、五つの記憶
          </span>
        </div>
      </section>

      <section className="storybook-film-showcase storybook-complete-experience section" id="sample-film">
        <div className="shell">
          <div className="storybook-heading">
            <div>
              <p className="eyebrow">A COMPLETE MOVING STORYBOOK + A WEBSITE JUST FOR YOUR DOG</p>
              <h2>
                映像だけではありません。
                <br />
                その子のホームページまで、一緒に。
              </h2>
            </div>
            <p>
              約40秒の動く絵本と、その後も思い出を増やせる専用ホームページ。
              <br />
              一度きりの動画納品ではなく、二つを一つの作品としてお届けします。
            </p>
          </div>
          <ul className="storybook-complete-includes" aria-label="制作プランに含まれるもの">
            <li><span>01</span><strong>約40秒の動く絵本</strong><small>水彩の5つの物語</small></li>
            <li><span>02</span><strong>愛犬専用ホームページ</strong><small>公開期限・月額料金なし</small></li>
            <li><span>03</span><strong>育てられる写真アルバム</strong><small>完成後も写真を追加</small></li>
            <li><span>04</span><strong>歩いて話すミニキャラクター</strong><small>その子らしい案内役</small></li>
          </ul>
          <div className="storybook-film-frame">
            <video
              controls
              preload="metadata"
              playsInline
              poster="/film/moka/05-storybook-lantern.webp"
              aria-label="モカと五つの記憶の完成映像"
            >
              <source src="/film/moka/complete-film.mp4" type="video/mp4" />
            </video>
            <div className="storybook-film-meta">
              <span>COMPLETE FILM · 00:39</span>
              <strong>モカと、五つの記憶</strong>
              <Link href="/film/moka-demo">作品ページで写真と全場面を見る →</Link>
            </div>
          </div>

          <div className="storybook-complete-website">
            <div className="storybook-complete-site-preview" aria-label="モカ専用ホームページのイメージ">
              <div className="storybook-complete-browser-bar" aria-hidden="true">
                <i /><i /><i /><span>MOKA&apos;S OWN WEBSITE</span>
              </div>
              <div className="storybook-complete-site-canvas">
                <Image
                  src="/film/moka/05-storybook-lantern.webp"
                  alt="モカ専用ホームページのメイン画面"
                  fill
                  sizes="(max-width: 900px) 90vw, 52vw"
                />
                <div className="storybook-complete-site-shade" aria-hidden="true" />
                <div className="storybook-complete-site-title">
                  <span>MOKA &amp; FIVE MEMORIES</span>
                  <strong>いつでも会える、<br />モカだけの場所。</strong>
                </div>
                <div className="storybook-complete-site-cards" aria-hidden="true">
                  <div><Image src="/film/moka/02-storybook-train.webp" alt="" width={180} height={110} /><span>STORYBOOK</span></div>
                  <div><Image src="/film/moka/09-autumn-ginkgo.webp" alt="" width={180} height={110} /><span>PHOTO ALBUM</span></div>
                  <div><Image src="/film/moka/03-storybook-bread.webp" alt="" width={180} height={110} /><span>FAMILY LETTER</span></div>
                </div>
                <div className="storybook-complete-site-character" aria-hidden="true">
                  <div>ぼくのページも、<br />できあがるよ。</div>
                  <Image src="/film/moka/character/frames/head-tilt.png" alt="" width={362} height={362} />
                </div>
              </div>
            </div>

            <div className="storybook-complete-site-copy">
              <p className="eyebrow">A WEBSITE JUST FOR YOUR DOG</p>
              <h3>完成した日から、<br />思い出がまた育ちはじめる。</h3>
              <p>
                映像、絵本ページ、元の写真、家族からの手紙を専用URLにまとめます。完成後の写真も追加でき、描き起こしたキャラクターがページを歩いて話しかけます。
              </p>
              <div className="storybook-complete-lifetime">
                <strong>公開期限なし</strong>
                <i aria-hidden="true" />
                <strong>月額料金なし</strong>
              </div>
              <Link className="button button-outline" href="/film/moka-demo">
                モカのホームページを体験する →
              </Link>
              <small>専用URLはご家族にも共有できます。</small>
            </div>
          </div>
        </div>
      </section>

      <section className="storybook-preview section" id="story-preview">
        <div className="shell">
          <div className="storybook-heading">
            <div>
              <p className="eyebrow">FIVE MEMORIES OF MOKA</p>
              <h2>
                雨の日も、旅の日も、
                <br />
                モカらしい一ページに。
              </h2>
            </div>
            <p>
              カードを横に送り、中央のつまみを左右に動かすと、
              <br />
              元の写真と描き下ろしたページを見比べられます。
            </p>
          </div>
          <div className="storybook-memory-scroll" aria-label="モカの五つの思い出">
            <ol className="storybook-memory-track">
              {storyPages.map((page) => (
                <li key={page.number}>
                  <figure>
                    <MiruBeforeAfter
                      beforeSrc={page.original}
                      afterSrc={page.image}
                      beforeAlt={`${page.label}の元写真`}
                      afterAlt={`動く絵本「${page.label}」の完成ページ`}
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
          </div>
          <p className="storybook-memory-scroll-note">
            <span aria-hidden="true">←</span> 横にスクロールして5つの思い出を見る <span aria-hidden="true">→</span>
          </p>
          <Link
            className="button button-outline storybook-preview-link"
            href="/film/moka-demo"
          >
            モカの作品ページを見る →
          </Link>
        </div>
      </section>

      <section className="storybook-line-stickers section" id="line-stickers">
        <div className="shell">
          <div className="storybook-line-sticker-heading">
            <div>
              <p className="eyebrow">LINE STICKERS INCLUDED FREE</p>
              <h2>
                LINEスタンプ8種類も、
                <br />
                今だけ無料でついてくる。
              </h2>
            </div>
            <div className="storybook-line-sticker-offer">
              <span>OPENING GIFT</span>
              <del>通常 ¥1,480相当</del>
              <strong>制作・登録料 ¥0</strong>
            </div>
          </div>
          <div className="storybook-line-sticker-showcase">
            <div className="storybook-line-sticker-preview">
              <Image
                src="/film/moka/line-stickers-preview-v2.png"
                alt="モカのキャラクターから作った、わん付きLINEスタンプ8種類"
                width={1536}
                height={1024}
                sizes="(max-width: 640px) calc(100vw - 36px), 1120px"
              />
            </div>
            <div className="storybook-line-sticker-copy">
              <p>
                専用ホームページのために描き起こしたキャラクターから、毎日使いやすい8種類のLINEスタンプを制作します。
                今だけ、制作とLINEへの登録を追加料金なしでプランに含めます。
              </p>
              <ul>
                <li><span>01</span><strong>その子のキャラクターで8種類</strong></li>
                <li><span>02</span><strong>毎日送りやすい日本語セット</strong></li>
                <li><span>03</span><strong>面倒なLINE登録までおまかせ</strong></li>
              </ul>
              <small>
                LINEで実際に使用する際は、LINE STOREでのスタンプ購入代金が別途必要です。文言指定・個別修正は含まれません。
              </small>
            </div>
          </div>
        </div>
      </section>

      <section className="process-section section" id="flow">
        <div className="shell">
          <p className="eyebrow">HOW YOUR STORYBOOK IS MADE</p>
          <div className="process-head">
            <h2>ご相談からお届けまで。</h2>
            <p>制作室で、物語・絵本ページ・完成映像を順番に確認できます。</p>
          </div>
          <ol className="process-list">
            {[
              [
                "01",
                "5つの物語と写真を送る",
                "物語にしたい出来事ごとに、その日の写真を1枚添えます。途中保存もできます。",
              ],
              [
                "02",
                "二つの物語案を受け取る",
                "担当者が写真とお話を読み、つながり方の異なる二つのあらすじをご提案します。",
              ],
              [
                "03",
                "1案を選び、そのまま決済する",
                "選んだ物語、確定料金、予定納期、キャンセル条件を確認すると、そのままカードでお支払いいただけます。",
              ],
              [
                "04",
                "絵本ページと文章を確認する",
                "全場面の絵と、その場面に入る短い文章を先にお見せします。絵本ページは合計2場面まで修正できます。",
              ],
              [
                "05",
                "小さな動きを加える",
                "承認された5枚の絵をもとに、各物語を5秒ずつ制作します。メインエピソードを選ぶ工程はありません。",
              ],
              [
                "06",
                "完成前の作品を確認する",
                "BGMと文章を含む約40秒の映像をご確認いただき、映像は合計1場面まで修正できます。",
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
            <p>二つの物語案、絵本ページ、約40秒の映像、公開期限・月額料金なしの専用サイトに、今だけLINEスタンプ8種類も追加料金なしで含みます。</p>
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
