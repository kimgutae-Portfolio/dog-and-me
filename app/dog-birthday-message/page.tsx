import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";
import { DEFAULT_SITE_ORIGIN } from "../lib/site";

const path = "/dog-birthday-message";
const title = "愛犬の誕生日メッセージ例文8選｜写真と一緒に残す言葉の書き方";
const description = "犬の誕生日に贈る短いメッセージ、1歳のお祝い、家族からのありがとうなど、日本語の例文8選。愛犬らしいエピソードを添えるコツと、写真・動画に言葉を残す方法を紹介します。";

export const metadata: Metadata = {
  title, description,
  alternates: { canonical: path },
  openGraph: {
    title: `${title}｜WAN MEMORY`, description, url: path,
    type: "article", locale: "ja_JP",
    images: [{ url: "/film/moka/03-storybook-bread.webp", width: 1672, height: 941, alt: "日常の一場面を描いた愛犬の水彩絵本" }],
  },
};

const examples = [
  ["短く、まっすぐに伝える", "お誕生日おめでとう。今日もそばにいてくれて、ありがとう。", "写真にひと言添えたいときに。名前を最初に入れると、呼びかけるような文章になります。"],
  ["1歳の誕生日に", "1歳のお誕生日おめでとう。はじめてがいっぱいの毎日を、一緒に過ごせてうれしいよ。", "初めてのお散歩や旅行など、実際にあった出来事をひとつ続けてみましょう。"],
  ["名前と年齢を入れて", "○○、○歳のお誕生日おめでとう。今年も、あなたらしい毎日を一緒に重ねようね。", "○○には名前、○歳には今回の年齢を入れて使えます。"],
  ["家族からのありがとう", "あなたがいると、何気ない日も家族の思い出になる。お誕生日おめでとう、いつもありがとう。", "家族が思い浮かべる『何気ない日』を、写真の説明として別に残すのもおすすめです。"],
  ["その子らしい仕草を添えて", "名前を呼ぶと首をかしげる、その仕草が大好き。お誕生日おめでとう、これからもよろしくね。", "首をかしげる部分は、愛犬が本当にする仕草に置き換えてください。"],
  ["毎日のお散歩を思い出に", "いつもの道も、あなたと歩くと特別な時間。お誕生日おめでとう、また一緒に歩こうね。", "散歩が好きな子へ。いつもの道で撮った写真と合わせると、日常の記録になります。"],
  ["長く一緒に過ごしてきた子へ", "一緒に重ねた毎日が、わたしたちの宝物。お誕生日おめでとう、これからもあなたのペースで。", "年齢だけでなく、一緒に過ごしてきた時間を伝えたいときに使える言葉です。"],
  ["動画の最後に添える", "生まれてきてくれて、家族になってくれて、ありがとう。お誕生日おめでとう。", "写真をつないだ動画や動く絵本の締めくくりに。画面では意味の区切りで改行すると読みやすくなります。"],
] as const;
const faqs = [
  ["犬の誕生日メッセージは短くても大丈夫ですか？", "はい。写真に添えるなら、お祝いと伝えたいことを一つずつ書くだけでも十分です。名前やその子らしい仕草を入れると、ご家族ならではの言葉になります。"],
  ["誕生日が分からない場合はどう書けばよいですか？", "誕生日を無理に決めず、家族に迎えた日を『うちの子記念日』としてお祝いする方法もあります。『家族になってくれてありがとう』など、その日に合う言葉で残せます。"],
  ["SNSと動画で同じメッセージを使えますか？", "同じ言葉を使えます。SNSでは出来事の説明も添え、動画では一画面に詰め込みすぎず短く区切ると読みやすくなります。公開前に写真の背景や文章に個人情報が含まれていないかも確認しましょう。"],
  ["WAN MEMORYで誕生日の思い出を絵本にできますか？", "誕生日の写真とエピソードを、5つの物語の一つとしてご用意いただけます。各物語には写真が1枚必要です。動く絵本の制作例と現在のサービス内容は、サイト内でご確認いただけます。"],
] as const;

export default function DogBirthdayMessagePage() {
  const structuredData = [
    ...createGuideStructuredData({ path, title, description, faqs }),
    {
      "@context": "https://schema.org", "@type": "BlogPosting",
      "@id": `${DEFAULT_SITE_ORIGIN}${path}#article`,
      headline: title, description, inLanguage: "ja-JP",
      mainEntityOfPage: `${DEFAULT_SITE_ORIGIN}${path}`,
      image: `${DEFAULT_SITE_ORIGIN}/film/moka/03-storybook-bread.webp`,
      author: { "@type": "Organization", name: "WAN MEMORY", url: DEFAULT_SITE_ORIGIN },
      publisher: { "@type": "Organization", name: "WAN MEMORY", url: DEFAULT_SITE_ORIGIN },
    },
  ];
  return (
    <InfoPage eyebrow="BIRTHDAY MESSAGE GUIDE" title="愛犬の誕生日メッセージ例文8選" lead="お祝いの言葉に、その子らしい思い出をひとつ。短いメッセージから動画に添える一文まで、ご家族の言葉で残すためのヒントをご紹介します。">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="seo-breadcrumb" aria-label="パンくずリスト"><Link href="/">WAN MEMORY</Link><span aria-hidden="true">/</span><span>愛犬の誕生日メッセージ</span></nav>
      <section className="seo-lead-panel">
        <p>「お誕生日おめでとう」のあとに、何を書こう。そんなときは、立派な文章にしようとせず、最近かわいいと思った仕草や一緒に過ごした場面を思い浮かべてみてください。写真だけでは思い出しにくい、その日の気持ちも残せます。</p>
        <p>この記事の例文は、ご家族が書くためのオリジナル文例です。お客様のレビューや実際のエピソードではありません。愛犬に合う言葉に置き換えてお使いください。</p>
      </section>
      <nav aria-label="この記事の目次"><ul>
        <li><a href="#examples">場面別のメッセージ例文8選</a></li>
        <li><a href="#writing">自分たちらしい言葉にする3つのコツ</a></li>
        <li><a href="#photos">写真・動画と一緒に残す方法</a></li>
        <li><a href="#faq">よくある質問</a></li>
      </ul></nav>
      <section id="examples"><h2>愛犬の誕生日に贈る、場面別メッセージ例文8選</h2>
        {examples.map(([heading, message, tip], i) => <section key={heading}>
          <h3>{i + 1}. {heading}</h3><blockquote><p>{message}</p></blockquote><p>{tip}</p>
        </section>)}
      </section>
      <section id="writing"><h2>自分たちらしい言葉にする3つのコツ</h2>
        <ol className="seo-photo-list">
          <li><span>01</span><div><strong>名前を呼んで、お祝いを伝える</strong><p>普段呼んでいる名前から始めると、いつもの声で語りかける文章になります。年齢を入れる場合は、写真を撮った年と合わせて確認しましょう。</p></div></li>
          <li><span>02</span><div><strong>具体的な出来事を一つ添える</strong><p>「かわいい」「大好き」に加えて、「帰ると玄関まで迎えに来てくれる」など、ご家族が実際に見ている場面を書きます。例文に合わせて、経験していない出来事を足す必要はありません。</p></div></li>
          <li><span>03</span><div><strong>これから一緒にしたいことを結びに</strong><p>「またあの道を歩こうね」「おうちでゆっくり過ごそうね」など、愛犬との普段の暮らしに合う言葉で締めくくります。長くなったら、いちばん伝えたい一文を残しましょう。</p></div></li>
        </ol>
      </section>
      <section id="photos"><h2>誕生日の言葉を、写真・動画と一緒に残す方法</h2>
        <div className="seo-card-grid">
          <article><h3>写真アルバムに日付とひと言</h3><p>名前・年齢・撮影日とメッセージをまとめて保存します。誕生日当日の写真だけでなく、その年によく見せてくれた仕草の写真も、成長を振り返る手がかりになります。</p></article>
          <article><h3>動画には、読み切れる長さで</h3><p>写真や動画の上に文章を載せるときは、顔を隠さない位置に置きます。スマートフォンで実際に再生し、文字が小さすぎないか、読む前に画面が変わらないか確認してください。</p></article>
          <article><h3>エピソードを添えて動く絵本に</h3><p>写真を撮った場所や、その日の出来事も一緒に残すと、物語にするための材料になります。WAN MEMORYでは、写真とエピソードから愛犬を主人公にした動く絵本を制作します。</p></article>
        </div>
        <p>写真を選ぶ段階なら<Link href="/dog-photo-guide">動く絵本の写真選びガイド</Link>、動画の構成を考えるなら<Link href="/aiken-shashin-douga">愛犬の写真を動画にする方法</Link>もご覧ください。</p>
      </section>
      <section><h2>誕生日の一日だけでなく、いつもの毎日も</h2><p>記念撮影の一枚に加えて、家でくつろぐ姿やお散歩の写真にも、その年の愛犬らしさが残っています。特別なイベントがなくても、写真を見て思い出すことを短く書き留めてみてください。</p><p>家族に迎えた日をお祝いする場合は、<Link href="/uchinoko-kinenbi-douga">うちの子記念日のプレゼントガイド</Link>も参考になります。</p></section>
      <section id="faq" className="seo-faq"><h2>愛犬の誕生日メッセージについてよくある質問</h2>{faqs.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">＋</span></summary><p>{a}</p></details>)}</section>
      <aside className="seo-cta"><p>写真と、その日に伝えたかった言葉から。</p><h2>愛犬との思い出を、動く絵本に。</h2><p>完成した作品は専用ホームページでご家族と見返せます。まずは制作例をご覧ください。</p><div><Link className="button button-primary" href="/film/moka-demo">完成作品を見る →</Link><StartStoryLink className="button button-outline">物語を相談する</StartStoryLink></div></aside>
      <SeoGuideLinks currentPath={path} />
    </InfoPage>
  );
}
