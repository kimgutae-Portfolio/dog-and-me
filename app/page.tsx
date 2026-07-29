import type { Metadata } from "next";
import Link from "next/link";
import { ScrollMemoryStory } from "./components/ScrollMemoryStory";
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
  PRELAUNCH_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  BUSINESS_ADDRESS,
  BUSINESS_NAME,
  BUSINESS_OPERATOR,
  BUSINESS_POSTAL_CODE,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_E164,
} from "./lib/site";
import { getRequestOrigin } from "./lib/site-server";

export const metadata: Metadata = {
  title: "愛犬の思い出動画・メモリーフィルム制作",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const homeFaqs = [
  ["写真は何枚必要ですか？", "お顔・全身・横向きの基準写真3枚が必須です。思い出の場面写真は任意で、あれば参考としてお預かりします。写真は最大30枚までお送りいただけます。"],
  ["モニター価格とは何ですか？", `サービス品質の確認と改善のため、初期${MEMORY_FILM_PRICING.launchLimit}組限定で ¥${formatYen(MEMORY_FILM_PRICING.launchPrice)}（税込）にて制作します。受付終了後は通常価格 ¥${formatYen(MEMORY_FILM_PRICING.regularPrice)}（税込）になります。`],
  ["AI映像で顔が変わることはありますか？", "生成表現には外見の揺らぎが生じる可能性があります。そのため自動納品はせず、担当者の確認とお客様のシーン確認を必ず行います。"],
  ["映像構成案2案とは何ですか？", "同じ写真と3つのエピソードから、切り口や場面の組み立てが異なる2案をご提案します。各エピソードを複数の場面へ広げ、お好きな1案を約1分の映像として詳しく仕上げます。"],
  ["2案の最後もそれぞれ違いますか？", "途中の物語や場面構成は異なりますが、最後は『いまを残す』共通エンディングです。家族を振り返り、いつもの道を並んで歩き続ける場面で結びます。"],
  ["すべての質問に答える必要がありますか？", "いいえ。答えにくい質問は飛ばせます。途中保存もできるので、準備ができた時に再開してください。"],
  ["写真や動画はAIの学習に使われますか？", "WAN MEMORYが、お預かりした写真やエピソードを独自のAIモデル学習、広告、ポートフォリオ公開に使用することはありません。制作の一部で外部の生成AI・映像制作サービスを利用する場合があり、外部サービスでのデータの取り扱いは利用するサービスの条件に基づきます。必要な内容をご案内し、同意を確認してから処理します。"],
  ["人と一緒に写った写真も提出できますか？", "はい。ご家族と一緒に写っている写真もお送りいただけます。人物のお顔は映像に使用・生成せず、後ろ姿・手元・足元・シルエットなど、お顔が分からない形でのみ表現します。"],
  ["家族写真を映像に入れられますか？", "はい。後ろ姿など、お顔が分からないかたちであれば映像に使用できます。お顔がはっきり写る場面は使用しません。ご希望がある場合は、お申し込み後のメッセージでご相談ください。"],
  ["子どもが写った写真も送れますか？", "保護者の同意を得た写真のみお送りください。未成年者のお顔もAIで生成・使用せず、愛犬だけを切り抜くか、後ろ姿などお顔が分からない形でのみ使用します。"],
  ["映像の雰囲気やBGMは選べますか？", "約1分・16:9・あたたかな実写風のトーンで統一しています。BGMと短い字幕は、いただいたエピソードに合わせて担当ディレクターがお選びします。ご希望があればお申し込み後のメッセージでご相談ください。"],
  ["専用ウェブサイトとは何ですか？", "完成映像、写真、メッセージをまとめたお客様専用ページです。制作室で表示する写真を整え、専用URLからいつでも見返せます。検索結果には掲載しません。"],
  ["ページの動画は保存できますか？", "動画はページ内での鑑賞専用で、ダウンロードボタンは設けず、元の動画ファイルも直接表示しません。ただし、端末の画面録画などを技術的に完全に防ぐことはできません。"],
  ["完成までどのくらいかかりますか？", "必要な素材とお支払いの確認後、通常10〜14営業日を目安にしています。お客様の確認期間や修正内容により前後するため、受付時に予定日をご案内します。"],
  ["支払いはいつ行いますか？", "相談フォームの送信時には料金は発生しません。写真と内容を確認した後、制作室で確定料金、予定納期、キャンセル条件をご案内します。内容に同意いただいた後、制作開始前にStripeのカード決済画面からお支払いいただきます。"],
  ["キャンセルや返金はできますか？", "決済前のキャンセル料金はかかりません。決済後でも制作着手前は全額返金します。制作着手後は、発生済みの制作費・外部サービス費を差し引いて返金額をご案内します。詳しくは特定商取引法に基づく表記をご確認ください。"],
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
      telephone: SUPPORT_PHONE_E164,
      address: {
        "@type": "PostalAddress",
        postalCode: BUSINESS_POSTAL_CODE,
        addressRegion: "大阪府",
        addressLocality: "堺市中区",
        streetAddress: BUSINESS_ADDRESS.replace("大阪府堺市中区", ""),
        addressCountry: "JP",
      },
      description: SITE_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${origin}/#memory-film-service`,
      name: "愛犬メモリーフィルム制作",
      serviceType: "愛犬の思い出動画・メモリーフィルム制作",
      description: SITE_DESCRIPTION,
      url: `${origin}/#plans`,
      provider: { "@id": `${origin}/#organization` },
      areaServed: { "@type": "Country", name: "日本" },
      availableLanguage: "日本語",
      image: `${origin}/og.png`,
      offers: {
        "@type": "Offer",
        price: MEMORY_FILM_PRICING.launchPrice,
        priceCurrency: "JPY",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: MEMORY_FILM_PRICING.launchPrice,
          priceCurrency: "JPY",
          valueAddedTaxIncluded: true,
        },
        availability: "https://schema.org/InStock",
        url: `${origin}/#plans`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${origin}/#faq`,
      mainEntity: homeFaqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <MobileStickyCta />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-media" aria-hidden="true">
          <div className="hero-film-grain" />
          <div className="hero-caption">
            <span>SCENE 07</span>
            <span>いつもの帰り道</span>
          </div>
        </div>
        <div className="shell hero-content">
          {!APPLICATIONS_OPEN && (
            <aside className="prelaunch-status" role="status" aria-label="サービス公開状況">
              <span>PREPARING FOR LAUNCH</span>
              <strong>{PRELAUNCH_TITLE}</strong>
              <p>{PRELAUNCH_COPY}</p>
            </aside>
          )}
          <p className="eyebrow light">YOUR DOG. YOUR DAYS. YOUR MEMORY.</p>
          <h1 id="hero-title">
            一緒に過ごした時間を、
            <br />
            一本のメモリーフィルムに。
          </h1>
          <p className="hero-copy">
            愛犬の写真とエピソードをもとに、思い出のワンシーンを
            <br className="desktop-only" />
            あたたかな実写風の場面として再構成する映像です。
          </p>
          <div className="hero-actions">
            {APPLICATIONS_OPEN ? (
              <StartStoryLink className="button button-primary">
                思い出をつくる <span aria-hidden="true">→</span>
              </StartStoryLink>
            ) : (
              <span className="button button-prelaunch" aria-disabled="true">{PRELAUNCH_CTA}</span>
            )}
            <Link className="text-link light-link" href="/film/hinata-demo">
              完成ページを体験する <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className="scroll-note" aria-hidden="true">
          SCROLL <span />
        </div>
      </section>

      <section className="intro section" id="about">
        <div className="shell intro-grid">
          <div>
            <p className="eyebrow">OUR APPROACH</p>
            <h2 className="display-title">
              記録ではなく、
              <br />
              記憶を残す。
            </h2>
          </div>
          <div className="intro-copy">
            <p>
              何気ない寝顔、いつもの散歩道、家族になった日のこと。
              大切なのは、きれいな写真の枚数ではなく、その子らしい時間です。
            </p>
            <p>
              お話を伺いながら、一頭一頭に合わせた構成をつくり、実写素材と丁寧な映像表現で一本の作品にします。
            </p>
            <div className="trust-row" aria-label="サービスの特徴">
              <span>実写中心</span>
              <span>人の手で監修</span>
              <span>写真3枚・思い出3つから</span>
            </div>
          </div>
        </div>
      </section>

      <ScrollMemoryStory />

      <section className="purpose-section section-tight">
        <div className="shell">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">ONE MEMORY FILM</p>
              <h2>いまを残す、一つのかたち。</h2>
            </div>
            <p>一緒に過ごしている今を、その子らしい約1分のメモリーフィルムにします。</p>
          </div>
          <div className="purpose-grid single">
            <article className="purpose-card purpose-now">
              <span className="purpose-number">01</span>
              <div className="purpose-card-content">
                <p className="card-kicker">いまを残す思い出フィルム</p>
                <h3>いつもの日々を、未来の宝物に。</h3>
                <p className="purpose-description">散歩やお昼寝、家族を待つ後ろ姿。今を一緒に過ごしているその子の表情を映像に残します。</p>
                <div className="purpose-ending"><span>COMMON ENDING</span><strong>また明日も、いつもの道を。</strong><p>家族を振り返り、並んで歩き続けるエンディング。</p></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="film-section section" id="films">
        <div className="shell">
          <div className="film-heading">
            <div>
              <p className="eyebrow light">FILM MOOD</p>
              <h2>一頭ごとに、違う物語。</h2>
            </div>
            <p>
              派手な演出よりも、その子らしいしぐさと空気を大切に。
              <br />
              ご希望に合わせて、映像の温度を整えます。
            </p>
          </div>
          <div className="film-grid">
            <Link className="film-card film-card-main" href="/film/hinata-demo">
              <div
                className="film-still still-warm"
                aria-hidden="true"
                style={{ backgroundImage: "url('/film/hinata/card-poster.jpg')", backgroundPosition: "center" }}
              >
                <span className="play-mark">▶</span>
                <span className="film-time">00:48</span>
              </div>
              <div className="film-meta">
                <div>
                  <p>ひなたと歩いた、いつもの季節</p>
                  <span>Warm daily film</span>
                </div>
                <span>柴犬・4歳</span>
              </div>
            </Link>
            <article className="film-card">
              <div className="film-still still-spring" aria-hidden="true">
                <span className="play-mark">▶</span>
                <span className="film-time">00:58</span>
              </div>
              <div className="film-meta">
                <div>
                  <p>はじめての春</p>
                  <span>Anniversary film</span>
                </div>
                <span>トイプードル・1歳</span>
              </div>
            </article>
            <article className="film-card">
              <div className="film-still still-sunset" aria-hidden="true">
                <span className="play-mark">▶</span>
                <span className="film-time">01:00</span>
              </div>
              <div className="film-meta">
                <div>
                  <p>はじめての海</p>
                  <span>Cinematic daily film</span>
                </div>
                <span>ゴールデンレトリバー・5歳</span>
              </div>
            </article>
          </div>
          <p className="portfolio-note">※ 掲載作品は1次開発用の表現サンプルです。</p>
        </div>
      </section>

      <section className="demo-teaser section" id="demo">
        <div className="shell demo-teaser-grid">
          <div className="demo-teaser-copy">
            <p className="eyebrow">CUSTOMER SITE DEMO</p>
            <h2>完成後のページを、<br />そのまま体験。</h2>
            <p>映像が完成したら、WAN MEMORYのドメイン内にその子だけのページを制作します。映像、写真、物語、ご家族からの言葉が実際にどう見えるか、実際の制作事例でご覧ください。</p>
            <Link className="button button-primary" href="/film/hinata-demo">ひなたの完成デモを見る <span aria-hidden="true">→</span></Link>
          </div>
          <div className="demo-browser-preview" aria-hidden="true">
            <div className="demo-browser-bar"><span /><span /><span /><p>WAN MEMORY / MEMORY / HINATA</p></div>
            <div className="demo-browser-image" style={{ backgroundImage: "linear-gradient(180deg, rgba(20,25,21,.05), rgba(20,25,21,.5)), url('/film/hinata/demo-poster.jpg')", backgroundPosition: "center" }}><span>PLAY SAMPLE</span></div>
            <div className="demo-browser-copy"><small>MEMORY FILM · SHIBA INU</small><strong>ひなたと歩いた、いつもの季節</strong><p>桜の花びらを追いかけた春から、いつもの帰り道まで。</p></div>
          </div>
        </div>
      </section>

      <section className="process-section section" id="flow">
        <div className="shell">
          <p className="eyebrow">HOW IT WORKS</p>
          <div className="process-head">
            <h2>ご登録からお届けまで、8つのステップ。</h2>
            <p>ログイン後の制作室で、写真の追加から納品まで確認できます。</p>
          </div>
          <ol className="process-list">
            {[
              ["01", "会員登録して、相談を始める", "メールアドレスで専用制作室をつくり、愛犬の基本情報から入力を始めます。"],
              ["02", "思い出と写真を預ける", "エピソードと写真を非公開領域へ送信します。HEIC写真は自動でJPGへ変換します。"],
              ["03", "素材確認を待つ", "担当者がその子らしさとご希望を確認します。写真は制作中も追加できます。"],
              ["04", "映像構成案2案を受け取る", "3つのエピソードを複数の場面へ広げ、方向性の異なる2つの構成案を制作室へお届けします。"],
              ["05", "1案を選び、料金と納期を確認する", "選んだ方向性、確定料金、予定納期をご確認いただいた後に制作を始めます。"],
              ["06", "場面イメージを確認する", "映像にする前の場面イメージをお届けします。ご確認後、調整のご希望を2回までお受けします。"],
              ["07", "映像を制作・確認し、修正を依頼する", "約1分の映像をご確認いただき、外見や動き、リード、字幕など気になる点をお知らせください。"],
              ["08", "完成映像と専用サイトを受け取る", "完成映像と、その子だけのメモリーサイトを受け取り、専用URLからいつでも見返せます。"],
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
              <p className="eyebrow">PLANS</p>
              <h2>迷わない、ひとつのプラン。</h2>
            </div>
            <p>映像構成案のご提案から、約1分の完成映像と専用サイトまで。</p>
          </div>
          <aside className="included-memory-site" aria-label="メモリーフィルムに含まれる専用メモリーサイト">
            <div className="included-memory-site-intro">
              <p className="included-label">INCLUDED IN MEMORY FILM</p>
              <div>
                <h3>映像を受け取ったあとも、思い出へ帰れる場所。</h3>
                <p>完成映像だけでなく、愛犬へのメッセージ、選んだ物語、思い出の写真をひとつにまとめた専用ページを、WAN MEMORYのドメイン内にお客様ごとに制作します。追加料金はかかりません。</p>
              </div>
            </div>
            <div className="memory-site-usage">
              <p className="memory-site-usage-title">専用メモリーサイトの使い方</p>
              <ol>
                <li><span>01</span><div><strong>納品のお知らせを受け取る</strong><p>映像が完成すると、ログイン後の制作室に「専用メモリーサイトを見る」ボタンが表示されます。</p></div></li>
                <li><span>02</span><div><strong>写真を選び、アルバムを整える</strong><p>制作室で、専用ページに表示する思い出の写真を選べます。</p></div></li>
                <li><span>03</span><div><strong>専用URLから、何度でも振り返る</strong><p>完成映像・メッセージ・物語・写真を、ひとつのページでいつでもご覧いただけます。映像は閲覧専用です。</p></div></li>
              </ol>
              <div className="memory-site-note"><span>PRIVATE</span><p>ページは検索結果に表示されません。専用URLからログインせずに閲覧でき、必要な場合はURLを新しく発行できます。画面録画などを技術的に完全に防ぐことはできません。</p></div>
              <Link className="memory-site-demo-link" href="/film/hinata-demo">実際の完成イメージを見る →</Link>
            </div>
          </aside>
          <div className="pricing-grid">
            <LivePriceCard />
          </div>
        </div>
      </section>

      <section className="guide-section section" aria-labelledby="guide-title">
        <div className="shell">
          <div className="section-heading-row">
            <div><p className="eyebrow">WAN MEMORY GUIDE</p><h2 id="guide-title">はじめての方へ。</h2></div>
            <p>思い出動画の特徴と、写真の準備方法をご案内します。</p>
          </div>
          <div className="guide-card-grid">
            <Link href="/aiken-omoide-douga"><span>01</span><h3>愛犬の思い出動画とは</h3><p>写真からどのように約1分の映像をつくるのか、制作方法と流れをご紹介します。</p><i aria-hidden="true">→</i></Link>
            <Link href="/uchinoko-kinenbi-douga"><span>02</span><h3>うちの子記念日を動画に</h3><p>家族になった日や誕生日までの時間を、物語として残すヒントをまとめました。</p><i aria-hidden="true">→</i></Link>
            <Link href="/dog-photo-guide"><span>03</span><h3>愛犬写真の選び方</h3><p>顔・全身・横向きなど、外見を保ちやすい基準写真の選び方をご案内します。</p><i aria-hidden="true">→</i></Link>
          </div>
        </div>
      </section>

      <section className="faq-section section" id="faq">
        <div className="shell faq-grid">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2>よくあるご質問</h2>
            <p className="faq-lead">まだ決めきれないことがあっても大丈夫です。受付後に担当者と一緒に整理できます。</p>
          </div>
          <div className="faq-list">
            {homeFaqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<span aria-hidden="true">＋</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-inner">
          <p className="eyebrow light">BEGIN YOUR MEMORY</p>
          <h2>{APPLICATIONS_OPEN ? <>その子のことを、<br />ゆっくり聞かせてください。</> : <>ただいま、正式公開の<br />準備を進めています。</>}</h2>
          <p>{APPLICATIONS_OPEN ? `先着${MEMORY_FILM_PRICING.launchLimit}組は ¥${formatYen(MEMORY_FILM_PRICING.launchPrice)}（税込）。入力内容はこの端末に自動で保存されます。` : PRELAUNCH_COPY}</p>
          {APPLICATIONS_OPEN ? (
            <StartStoryLink className="button button-cream">思い出づくりを始める <span aria-hidden="true">→</span></StartStoryLink>
          ) : (
            <span className="button button-prelaunch button-prelaunch-light" aria-disabled="true">{PRELAUNCH_CTA}</span>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
