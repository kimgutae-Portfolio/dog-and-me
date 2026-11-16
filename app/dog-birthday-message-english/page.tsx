import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { createGuideStructuredData } from "../lib/seo";
import { DEFAULT_SITE_ORIGIN, SITE_NAME } from "../lib/site";
import styles from "./birthday-english.module.css";

const path = "/dog-birthday-message-english";
const title = "愛犬の誕生日メッセージを英語で｜写真・ケーキ・SNSに使える例文12選";
const description = "犬の誕生日を英語でお祝いしたい方へ。写真やケーキに添える短文、インスタの投稿、カードや動画に使える英語のメッセージ12選を和訳付きで紹介。1st・2nd・3rdなど年齢の書き方も解説します。";
const image = "/film/moka/03-storybook-bread.webp";
const imageAlt = "愛犬モカとの日常を描いた水彩タッチの絵本ページ";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    title: `${title}｜${SITE_NAME}`,
    description,
    url: path,
    type: "article",
    locale: "ja_JP",
    images: [{ url: image, width: 1672, height: 941, alt: imageAlt }],
  },
  twitter: { card: "summary_large_image", title, description, images: [{ url: image, alt: imageAlt }] },
};

const groups = [
  {
    id: "short-messages",
    label: "ケーキ・写真に添える短文",
    intro: "ケーキのプレートや写真に添えるなら、一目で読める長さに。名前が長いときは、最初の行にお祝い、次の行に名前を置くと収めやすくなります。",
    examples: [
      { situation: "名前を入れる定番の一言", english: "Happy birthday, Moka!", japanese: "モカ、お誕生日おめでとう！" },
      { situation: "初めての誕生日", english: "Happy 1st birthday, Moka!", japanese: "モカ、1歳のお誕生日おめでとう！" },
      { situation: "3歳の記念写真に", english: "Three looks good on you, Moka!", japanese: "モカ、3歳になったきみも素敵だよ！" },
      { situation: "小さなスペースで愛情を伝える", english: "Love you, Moka!", japanese: "モカ、大好きだよ！" },
    ],
  },
  {
    id: "captions",
    label: "インスタ・SNSの投稿文",
    intro: "SNSでは、愛犬へのお祝いに、その日の写真で伝えきれないことを一つ添えてみましょう。いつもの遊びや散歩の様子なら、あとで読み返したときにもその子の姿が浮かびます。",
    examples: [
      { situation: "誕生日の朝の様子を添える", english: "Moka turns five today. She started her birthday exactly as she starts every day: by bringing us her favorite toy.", japanese: "モカは今日で5歳。誕生日の朝もいつもどおり、お気に入りのおもちゃを持ってきてくれました。" },
      { situation: "子犬の頃と今の写真を並べる", english: "The puppy in the first photo is three today. Same favorite spot by the window, much bigger paws.", japanese: "1枚目の写真の子犬が、今日で3歳。窓辺がお気に入りなのは今も同じで、足はずいぶん大きくなりました。" },
      { situation: "シニア犬のいつもの一日", english: "Twelve today. The walks are slower now, but Moka still stops at her favorite tree every time.", japanese: "今日で12歳。歩くのはゆっくりになったけど、モカは今もお気に入りの木のところで毎回立ち止まります。" },
      { situation: "名前と年齢を入れた明るい一言", english: "Moka is eight today and still has two favorite words: ‘walk’ and ‘snack.’", japanese: "モカは今日で8歳。今も大好きな言葉は二つ。「お散歩」と「おやつ」です。" },
    ],
  },
  {
    id: "cards-and-videos",
    label: "カード・動画で伝えるありがとう",
    intro: "カードは普段の思い出を一文添えやすく、動画ではお祝いの言葉と伝えたい気持ちを別々の画面に分けると読みやすくなります。",
    examples: [
      { situation: "一人の飼い主から、朝の散歩の思い出を", english: "Happy birthday, Moka. Even on my sleepiest mornings, our walk is my favorite part of the day.", japanese: "モカ、お誕生日おめでとう。眠くてたまらない朝も、きみとの散歩が一日のいちばんの楽しみだよ。" },
      { situation: "家族みんなから、帰宅の思い出を", english: "Happy birthday, Moka. Coming home is our favorite part of the day because you’re there.", japanese: "モカ、お誕生日おめでとう。きみが待っていてくれるから、家に帰る時間が一日の楽しみです。" },
      { situation: "年を重ねた愛犬に", english: "Happy 13th birthday, Moka. Here’s to more sunny naps and walks at your pace.", japanese: "モカ、13歳のお誕生日おめでとう。これからもひなたでお昼寝して、きみのペースでお散歩しようね。" },
      { situation: "思い出動画の最後に", english: "Happy birthday, Moka. I’m so glad I get to share these ordinary days with you.", japanese: "モカ、お誕生日おめでとう。何気ない毎日をきみと過ごせることが、本当にうれしいよ。" },
    ],
  },
] as const;

const faqs = [
  ["犬の誕生日に Happy Birthday と書いてもいいですか？", "はい。愛犬に呼びかけるなら、Happy birthday, Moka! のように名前を添えられます。ケーキやカードの見出しでは Happy Birthday と書くこともできます。"],
  ["愛犬の1歳の誕生日は英語でどう書きますか？", "お祝いの言葉なら Happy 1st birthday!、投稿で「今日で1歳です」と伝えるなら Moka turns one today. と書けます。"],
  ["保護犬など、誕生日が分からない場合はどう書きますか？", "迎えた日をお祝いするなら、Happy Gotcha Day, Moka! と書くこともできます。家族になった日を祝う、親しみのある表現です。Thank you for being part of our family. なら、日付を入れずに家族からの気持ちを伝えられます。"],
] as const;

export default function DogBirthdayMessageEnglishPage() {
  const url = `${DEFAULT_SITE_ORIGIN}${path}`;
  const organization = { "@type": "Organization", name: SITE_NAME, url: DEFAULT_SITE_ORIGIN };
  const structuredData = [
    ...createGuideStructuredData({ path, title, description, faqs }),
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: title,
      description,
      inLanguage: "ja-JP",
      mainEntityOfPage: url,
      image: `${DEFAULT_SITE_ORIGIN}${image}`,
      author: organization,
      publisher: organization,
    },
  ];

  return (
    <InfoPage
      eyebrow="BIRTHDAY MESSAGE GUIDE"
      title={<><span className={styles.titlePhrase}>愛犬の誕生日メッセージを</span><wbr /><span className={styles.titlePhrase}>英語で伝える例文12選</span></>}
      lead="ケーキや写真に添える一言から、SNSの投稿文、カードや動画のメッセージまで。そのまま使える英文と日本語訳を、使う場面ごとにまとめました。"
      articleClassName={styles.article}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="seo-breadcrumb" aria-label="パンくずリスト">
        <Link href="/">WAN MEMORY</Link><span aria-hidden="true">/</span><span>愛犬の誕生日メッセージ（英語）</span>
      </nav>
      <section className="seo-lead-panel" aria-labelledby="quick-answer">
        <h2 id="quick-answer">名前と年齢を入れて、お祝いの一言に</h2>
        <p>短く書くなら <strong lang="en">Happy birthday, Moka!</strong>（モカ、お誕生日おめでとう！）。年齢も添えるなら <strong lang="en">Happy 1st birthday, Moka!</strong>（モカ、1歳のお誕生日おめでとう！）のように書けます。</p>
        <p>文例の「Moka」は愛犬の名前に、年齢や出来事は実際の思い出に置き換えてお使いください。<Link href="/dog-birthday-message">日本語の誕生日メッセージ例文</Link>もあります。</p>
      </section>

      <nav className="seo-toc" aria-label="この記事の目次">
        <p>この記事の目次</p>
        <ul>
          {groups.map(({ id, label }) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}
          <li><a href="#age">1st・2nd・3rdなど年齢の書き方</a></li>
          <li><a href="#faq">よくある質問</a></li>
        </ul>
      </nav>

      {groups.map(({ id, label, intro, examples }) => (
        <section id={id} key={id}>
          <h2>{label}</h2>
          <p>{intro}</p>
          <ul className={styles.examples}>
            {examples.map(({ situation, english, japanese }) => (
              <li key={situation}>
                <h3>{situation}</h3>
                <p className={styles.english} lang="en">{english}</p>
                <p>{japanese}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section id="age">
        <h2>1st・2nd・3rdなど、英語での年齢の書き方</h2>
        <p>「○歳のお誕生日おめでとう」は <strong lang="en">Happy <span lang="ja">［序数］</span> birthday!</strong> が基本です。<span lang="en">1st birthday</span> は「1歳の誕生日」。<span lang="en">Moka is one today.</span> と書けば「モカは今日で1歳です」という報告になります。</p>
        <dl className={styles.ages}>
          <div><dt>1歳</dt><dd lang="en">1st birthday</dd></div>
          <div><dt>2歳</dt><dd lang="en">2nd birthday</dd></div>
          <div><dt>3歳</dt><dd lang="en">3rd birthday</dd></div>
          <div><dt>4歳</dt><dd lang="en">4th birthday</dd></div>
          <div><dt>11歳・12歳・13歳</dt><dd lang="en">11th / 12th / 13th birthday</dd></div>
        </dl>
        <p>11・12・13の後ろにはそれぞれ <strong lang="en">th</strong> が付きます。プレートや動画に入れる前に、名前のつづりと年齢を一度確認しましょう。序数の一覧は <a href="https://dictionary.cambridge.org/us/topics/mathematics-and-arithmetic/ordinal-numbers/">Cambridge Dictionary</a> でも確認できます。</p>
      </section>

      <section id="faq" className="seo-faq">
        <h2>愛犬の誕生日メッセージについてよくある質問</h2>
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}<span aria-hidden="true">＋</span></summary>
            <p>{answer}</p>
          </details>
        ))}
        <p>家族に迎えた日のお祝いには、<Link href="/uchinoko-kinenbi-douga">うちの子記念日のプレゼントガイド</Link>もご覧ください。</p>
      </section>

      <aside className="seo-cta">
        <h2>誕生日の写真を、何度でも見返せる物語に。</h2>
        <p>誕生日の一枚に、いつもの散歩やお昼寝の写真も添えて。WAN MEMORYでは、写真とエピソードから愛犬が主人公の動く絵本と専用ホームページを制作します。</p>
        <div><Link className="button button-primary" href="/film/moka-demo">動く絵本の完成例を見る →</Link></div>
      </aside>
      <SeoGuideLinks currentPath={path} />
    </InfoPage>
  );
}
