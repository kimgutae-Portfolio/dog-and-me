import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { SeoGuideLinks } from "../components/SeoGuideLinks";
import { StartStoryLink } from "../components/StartStoryLink";
import { createGuideStructuredData } from "../lib/seo";

const path = "/pet-loss-aiken-omoide";
const title = "ペットロスと愛犬の思い出の残し方｜写真・メモリアルグッズ";
const description =
  "ペットロスの中で愛犬との思い出を残す方法を紹介。写真整理、アルバム、位牌・仏壇などのメモリアルグッズ、動画やオリジナル絵本の違いと選び方をまとめました。";

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
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "愛犬との思い出を残すWAN MEMORY" }],
  },
};

const faqs = [
  [
    "亡くなった愛犬の写真を、すぐに整理したほうがいいですか？",
    "急いで整理する必要はありません。写真を見ることがつらい時はそのまま保管し、見返せる一枚や、覚えていることを一言だけ残すところから始めても大丈夫です。",
  ],
  [
    "犬の位牌や仏壇は必要ですか？",
    "必ず用意しなければならないものではありません。手を合わせる場所がほしい方には向いていますが、写真、アルバム、遺骨カプセル、動画など、ご家族が落ち着いて思い出せる形を選べます。",
  ],
  [
    "WAN MEMORYで位牌や仏壇を購入できますか？",
    "WAN MEMORYは位牌や仏壇の販売店ではありません。愛犬の写真と5つの思い出から、動く絵本と専用ホームページを制作するサービスです。",
  ],
  [
    "元気なうちの思い出づくりにも利用できますか？",
    "はい。お別れの後だけでなく、誕生日、うちの子記念日、旅行やいつもの散歩など、今一緒に過ごしている時間を物語に残すためにもご利用いただけます。",
  ],
] as const;

export default function PetLossAikenOmoidePage() {
  const structuredData = createGuideStructuredData({ path, title, description, faqs });

  return (
    <InfoPage
      eyebrow="PET LOSS & MEMORIES"
      title="悲しみの中で、愛犬との思い出を残す。"
      lead="無理に気持ちを整理しなくても大丈夫です。今できる形で、その子と過ごした時間を残す方法があります。"
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
        <span>ペットロスと愛犬の思い出</span>
      </nav>

      <section>
        <h2>ペットロスの感じ方に、正解や順番はありません</h2>
        <p>
          愛犬とのお別れのあと、写真を見返したくなる方もいれば、まだ見られない方もいます。どちらも自然なことです。思い出を形にすることも、今は何もしないことも、ご家族のペースで選べます。
        </p>
        <p>
          日常生活が長く続けられないほどつらい時は、一人で抱えず、身近な方や医療・相談機関に頼ることも大切です。
        </p>
      </section>

      <section>
        <h2>愛犬の思い出を残す、四つの方法</h2>
        <div className="seo-card-grid">
          <article>
            <strong>写真・フォトアルバム</strong>
            <p>表情や毛色をそのまま残せます。日付と短い言葉を添えると、その日の空気まで思い出しやすくなります。</p>
          </article>
          <article>
            <strong>位牌・仏壇・メモリアルグッズ</strong>
            <p>家の中に手を合わせる場所を作りたい方に。大きさ、素材、写真の入れ替えやすさ、置く場所を確認して選びます。</p>
          </article>
          <article>
            <strong>日記・手紙</strong>
            <p>好きだった食べ物、呼び名、毎日のしぐさなど、写真には写らない記憶を残せます。一行からでも十分です。</p>
          </article>
          <article>
            <strong>動画・オリジナル絵本</strong>
            <p>いくつかの出来事を一つの物語として見返したい方に。家族と共有しやすく、声や動きの記録と一緒に残せます。</p>
          </article>
        </div>
      </section>

      <section>
        <h2>犬の位牌や仏壇を探している方へ</h2>
        <p>
          WAN MEMORYは、犬の位牌・仏壇・遺骨アクセサリーを販売するお店ではありません。写真とエピソードから、水彩で描く約40秒の動く絵本と、その子専用のホームページを制作しています。
        </p>
        <p>
          形のあるメモリアルグッズと、写真や物語はどちらか一つに決める必要はありません。手を合わせる場所にはお気に入りの写真を置き、家族で思い出を見返す時にはアルバムや物語を開く、という残し方もできます。
        </p>
      </section>

      <section className="seo-lead-panel">
        <h2>思い出を整理するときは、一枚から</h2>
        <ol>
          <li>今、見返してもつらすぎない写真を一枚選ぶ。</li>
          <li>その日の場所、季節、しぐさを一言だけ書く。</li>
          <li>写真を端末とは別の場所にも保存する。</li>
          <li>続きは、また見返したくなった時に行う。</li>
        </ol>
        <Link className="text-link" href="/aiken-shashin-seiri">
          愛犬の写真を整理・保存する方法を見る →
        </Link>
      </section>

      <section>
        <h2>お別れのあとだけでなく、今を残すためにも</h2>
        <p>
          思い出づくりは、元気なうちから始められます。誕生日や旅行のような特別な日だけでなく、玄関で待つ姿、いつもの散歩道、眠る前の表情も、その子らしさが残る大切な場面です。
        </p>
        <Link className="text-link" href="/aiken-omoide-douga">
          愛犬の思い出を残す方法を比べる →
        </Link>
      </section>

      <section className="seo-faq">
        <h2>ペットロスとメモリアルについてよくある質問</h2>
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}<span aria-hidden="true">＋</span>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>

      <aside className="seo-cta">
        <p>すぐに申し込まなくても大丈夫です。</p>
        <h2>どんな形になるか、まず完成作品をご覧ください。</h2>
        <div>
          <Link className="button button-outline" href="/film/moka-demo">
            完成作品を見る
          </Link>
          <StartStoryLink className="button button-primary">
            思い出を入力してみる →
          </StartStoryLink>
        </div>
      </aside>

      <SeoGuideLinks currentPath={path} />
    </InfoPage>
  );
}
