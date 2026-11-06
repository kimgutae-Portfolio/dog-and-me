import type { Metadata } from "next";
import Link from "next/link";
import { GuideWorkExample } from "../components/GuideWorkExample";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { formatYen, MEMORY_FILM_PRICING } from "../lib/pricing";
import { createGuideStructuredData } from "../lib/seo";
import { DEFAULT_SITE_ORIGIN } from "../lib/site";
import styles from "./photo-goods.module.css";

const path = "/aiken-photo-goods";
const title = "愛犬の写真で作るオーダーメイドグッズ｜5種類の選び方";
const description =
  "愛犬の写真をオーダーメイドの記念品にしたい方へ。フォトブック、写真パネル、キーホルダー、生活小物、動画・動く絵本を比較し、写真の準備、贈り物の確認事項、納期と費用の見方を紹介します。";
const image = "/film/moka/04-storybook-autumn.webp";

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
    images: [{ url: image, width: 1672, height: 941, alt: "愛犬のサンプル写真をもとに制作した、モカの水彩タッチの絵本ページ" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  },
};

const formats = [
  {
    name: "フォトブック",
    use: "手元でめくる",
    fit: "一枚に絞らず、子犬の頃から今までの変化や旅行の写真を順番に見返したい方に。写真のそばに日付や短い言葉を添えると、その日の出来事も残せます。",
    check: "必要な写真枚数、ページ数、文字を入れられる範囲を確認。製本したときの中央や端に、顔や残したい文字がかからないかも見ておきます。",
  },
  {
    name: "フォトフレーム・写真パネル",
    use: "部屋に飾る",
    fit: "家でくつろぐ姿など、お気に入りの一枚を毎日の暮らしの中で眺めたい方に。置く場所を先に決めると、縦長か横長か、どの写真を選ぶか考えやすくなります。",
    check: "仕上がりサイズと置き方・掛け方を確認。完成イメージの切り取り位置を見て、耳や足先まで残したいかを注文前に伝えます。",
  },
  {
    name: "キーホルダー・写真小物",
    use: "持ち歩く",
    fit: "鍵やバッグにつけて、愛犬の姿を身近に感じたい方に。背景も残すか、愛犬の輪郭に沿って切り抜くかで、同じ写真でも印象が変わります。",
    check: "実寸と印刷される面を確認。小さい仕上がりでも表情が分かる写真を選び、名前を入れる場合は文字の大きさと表記も確かめます。",
  },
  {
    name: "マグカップ・トートバッグなどの生活小物",
    use: "毎日使う",
    fit: "写真を眺めるだけでなく、普段使うものに取り入れたい方に。自分用なら好きな色、贈り物なら相手が実際に使う場面を基準に選べます。",
    check: "素材やお手入れ方法、写真が入る位置を確認。平面のプレビューだけでなく、実際の品に写真が載ったときの大きさも見ておきます。",
  },
  {
    name: "思い出動画・動く絵本",
    use: "家族で見返す",
    fit: "写真と一緒に、そのときの出来事や家族の気持ちも残したい方に。置き場所を増やさず、離れて暮らす家族と同じ作品を楽しむ選択肢です。",
    check: "実際の写真を編集する動画か、新しく描いた絵を動かす作品かを確認。動画データの受け取り方、再生方法、公開範囲、追加料金も見ておきましょう。",
  },
] as const;

const faqs = [
  [
    "愛犬の写真一枚から作れるグッズはありますか？",
    "一枚の写真を使う写真パネルや小物もありますが、必要枚数は商品によって異なります。フォトブックや動画は構成によって複数枚必要です。WAN MEMORYでは、五つの思い出それぞれに写真を一枚ずつご用意いただきます。",
  ],
  [
    "写真をそのまま残すものと、イラストにするものはどう選べばよいですか？",
    "撮影した表情や景色をそのまま残したいなら写真プリントや実写の動画が候補です。雰囲気や出来事を絵として楽しみたいならイラスト作品も選べます。加工の程度や作り方を確認し、完成サンプルを見て選びましょう。",
  ],
  [
    "友人へのプレゼントで先に確認しておくことは？",
    "写真を使ってよいか、どの写真が好きか、名前の正しい表記を確認しましょう。飾る場所や使い方の好みも人によって異なります。大切な写真を形にする贈り物なので、相手と一緒に選ぶ方法もあります。",
  ],
  [
    "WAN MEMORYで紙の絵本やキーホルダーも注文できますか？",
    "現在は制作していません。WAN MEMORYは約40秒の動く絵本、水彩タッチの絵本ページ5枚、専用ホームページなどをオンラインでお届けするサービスです。紙の本や物品の配送は含まれません。",
  ],
] as const;

export default function AikenPhotoGoodsPage() {
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
      image: `${DEFAULT_SITE_ORIGIN}${image}`,
      author: { "@type": "Organization", name: "WAN MEMORY", url: DEFAULT_SITE_ORIGIN },
      publisher: { "@type": "Organization", name: "WAN MEMORY", url: DEFAULT_SITE_ORIGIN },
    },
  ];

  return (
    <InfoPage
      eyebrow="PHOTO GIFT GUIDE"
      title={<><span className={styles.titlePhrase}>愛犬の写真で作る</span><wbr /><span className={styles.titlePhrase}>オーダーメイド</span><wbr /><span className={styles.titlePhrase}>グッズの選び方</span></>}
      lead="飾る、持ち歩く、家族で見返す。いつもの写真を、暮らしに合う記念品へ。五つの選択肢と、注文前に確認したいことをまとめました。"
      articleClassName={styles.article}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="seo-breadcrumb" aria-label="パンくずリスト">
        <Link href="/">WAN MEMORY</Link><span aria-hidden="true">/</span><span>愛犬の写真グッズの選び方</span>
      </nav>
      <p className={styles.byline}>編集：WAN MEMORY <span aria-hidden="true">/</span> <Link href="/guides">愛犬の思い出ガイド</Link></p>

      <section className={`seo-lead-panel ${styles.answer}`} aria-label="写真グッズ選びのポイント">
        <p className={styles.label}>まずは、残したいものから。</p>
        <h2>その一枚を残す？<br />その日の物語を残す？</h2>
        <p>写真をそのまま楽しみたいならプリントや小物、何枚もの変化を残したいならフォトブック、出来事や言葉も添えたいなら動画や動く絵本が候補になります。</p>
        <p>この記事で紹介するのは、犬が使うおもちゃやフードではなく、<strong>ご家族が写真と思い出を楽しむための記念品</strong>です。人気順のランキングや、各商品を実際に使い比べたレビューではありません。</p>
      </section>

      <nav className="seo-toc" aria-label="この記事の目次">
        <p>この記事の目次</p>
        <ul>
          <li><a href="#formats">写真で作る記念品、五つの選択肢</a></li>
          <li><a href="#photo-check">注文前の写真チェック</a></li>
          <li><a href="#gift-check">贈り物・費用・納期の確認</a></li>
          <li><a href="#storybook">動く絵本が合う場合・合わない場合</a></li>
          <li><a href="#faq">写真グッズについてよくある質問</a></li>
        </ul>
      </nav>

      <section id="formats">
        <h2>愛犬の写真で作る記念品、五つの選択肢</h2>
        <p>「何がいちばん良いか」より、「完成したあと、どこでどう楽しみたいか」を考えると選びやすくなります。</p>
        <div className={styles.formats}>
          {formats.map((format, index) => (
            <article className={styles.format} key={format.name}>
              <header><span className={styles.number}>0{index + 1}</span><div><p className={styles.use}>{format.use}</p><h3>{format.name}</h3></div></header>
              <p>{format.fit}</p>
              <p className={styles.check}><strong>注文前に確認</strong>{format.check}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="photo-check">
        <h2>オーダーメイドを頼む前の写真チェック</h2>
        <p>商品を決めたら、スマートフォンに保存した元の写真を開いて確認しましょう。必要な画像サイズやファイル形式は、注文するサービスの案内を優先してください。</p>
        <ol className="seo-photo-list">
          <li><span>01</span><div><strong>元画像と、顔の見え方</strong><p>スクリーンショットやSNSから保存し直した画像より、手元に元画像があればそちらを用意します。拡大して目・鼻・毛色が分かるか、残したい表情がぶれていないかを確認します。</p></div></li>
          <li><span>02</span><div><strong>切り取りたい範囲と余白</strong><p>顔だけを使うのか、耳やしっぽまで残すのかを決めます。縦横比や印刷範囲に合わせて写真が切り取られることもあるので、仕上がりのプレビューで確認しましょう。</p></div></li>
          <li><span>03</span><div><strong>写真の再現か、絵としての表現か</strong><p>同じ写真でも、写真プリント、手描き、AIを使った制作では仕上がりが異なります。作り方と修正できる範囲を確認し、「この表情を残したい」など大切な点を先に伝えます。</p></div></li>
        </ol>
        <p>物語にする写真を選んでいる方は、<Link href="/dog-photo-guide">動く絵本の写真選びガイド</Link>もご覧ください。</p>
      </section>

      <section id="gift-check">
        <h2>プレゼントにするなら、好み・費用・納期も確認</h2>
        <h3 className={styles.subheading}>サプライズより、その子らしい一枚を大切に</h3>
        <p>友人や家族へ贈る場合は、写真を使ってよいか、相手が気に入っている写真はどれかを確認しておくと安心です。名前の表記、飾る場所、使う色の好みも一緒に確認しましょう。</p>
        <h3 className={styles.subheading}>表示価格だけでなく、受け取りまでの条件を見る</h3>
        <p>本体価格のほかに、送料、写真の補正、名入れ、修正、追加データなどの料金がかかるかを確認します。動画や専用ページなら、データ保存の可否や閲覧条件も見ておきたいところです。</p>
        <p>納期は「購入した日から」なのか「写真や制作内容がそろってから」なのかを確認してください。記念日に贈るなら、制作・確認・修正・配送が必要な場合の時間まで含めて、受け取りたい日を伝えましょう。</p>
        <aside className={styles.memo} aria-label="注文前のメモ例">
          <h3>迷ったら、この四つをメモ</h3>
          <ul><li>どこで楽しむ？ ― 部屋に飾る／持ち歩く／家族で見る</li><li>何を残す？ ― 写真の表情／成長の変化／出来事と言葉</li><li>いつまでに必要？ ― 希望日と、準備・確認に使える日数</li><li>どこまで頼む？ ― 写真の加工、名入れ、修正、受け取り方</li></ul>
          <p>このメモをもとに問い合わせると、作品の見た目だけでなく、自分たちの暮らしに合うかを確かめられます。</p>
        </aside>
        <p>誕生日に添える言葉は<Link href="/dog-birthday-message">愛犬の誕生日メッセージ例文</Link>、家族に迎えた日のお祝いは<Link href="/uchinoko-kinenbi-douga">うちの子記念日のプレゼントガイド</Link>で紹介しています。</p>
      </section>

      <section id="storybook">
        <h2>動く絵本が合う場合・合わない場合</h2>
        <p>WAN MEMORYは、写真と五つのエピソードをもとに、<strong>AIを活用した水彩タッチの絵と文章</strong>を制作し、確認後に動きを加えるサービスです。写真そのものを動かす実写再現や、手描きの原画、紙の本の配送ではありません。</p>
        <div className={styles.fitGrid}>
          <div><h3>こんな残し方をしたい方に</h3><ul><li>写真を撮った日の出来事や気持ちも残したい</li><li>愛犬を主人公にした新しい絵本の表現を楽しみたい</li><li>離れて暮らす家族と、同じ作品を見返したい</li></ul></div>
          <div><h3>別の記念品が合う場合</h3><ul><li>写真の表情を加工せず、そのまま印刷したい</li><li>紙の本や、手に持てる小物を受け取りたい</li><li>今日や明日のプレゼントとして必要</li></ul></div>
        </div>
        <p>約40秒の動く絵本、水彩タッチの絵本ページ5枚、専用ホームページなどを、¥{formatYen(MEMORY_FILM_PRICING.price)}（税込）でオンライン納品します。通常の制作期間は10〜14営業日が目安です。希望日がある場合は、申し込み前に納品可能日をご確認ください。</p>
        <p><Link href="/#plans">プランの内容と料金</Link>・<Link href="/legal">納期や販売条件</Link>をご確認のうえ、写真プリントなどの記念品とも比べて選んでいただけます。</p>
      </section>

      <GuideWorkExample location="photo_goods_guide_example" />

      <section id="faq" className="seo-faq">
        <h2>愛犬の写真グッズについてよくある質問</h2>
        {faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}
      </section>

      <aside className="seo-cta">
        <p>写真と一緒に、その日の物語も残したい方へ。</p>
        <h2>まずは、実際の仕上がりを。</h2>
        <div><Link className="button button-primary" href="/film/moka-demo">完成作品を見てみる →</Link><StartStoryLink className="button button-outline">写真と思い出を相談する</StartStoryLink></div>
      </aside>

      <section className={styles.references} aria-label="この記事の参考情報">
        <h2>この記事について・参考情報</h2>
        <p>WAN MEMORYが、写真作品を選ぶ際の確認事項を整理したガイドです。他社商品の価格や仕様、納期を保証するものではありません。個別の条件は各販売元でご確認ください。</p>
        <p>写真を使う物品の種類については、<a href="https://pg-ja.fujifilm.com/pet.html" target="_blank" rel="noopener noreferrer">富士フイルム公式ストアのペット写真グッズ案内（新しいタブ）</a>も参考になります。WAN MEMORYが販売するのは、上記のオンライン制作プランのみです。</p>
      </section>
      <SeoGuideLinks currentPath={path} />
    </InfoPage>
  );
}
