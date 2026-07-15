import type { Metadata } from "next";
import Link from "next/link";
import { ScrollMemoryStory } from "./components/ScrollMemoryStory";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";

export const metadata: Metadata = {
  title: "愛犬との時間を一本の映画に",
};

export default function Home() {
  return (
    <main>
      <SiteHeader />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-media" aria-hidden="true">
          <div className="hero-film-grain" />
          <div className="hero-caption">
            <span>SCENE 07</span>
            <span>いつもの帰り道</span>
          </div>
        </div>
        <div className="shell hero-content">
          <p className="eyebrow light">YOUR DOG. YOUR DAYS. YOUR MEMORY.</p>
          <h1 id="hero-title">
            一緒に過ごした時間を、
            <br />
            一本の映画に。
          </h1>
          <p className="hero-copy">
            写真とエピソードをもとに、愛犬との記憶を
            <br className="desktop-only" />
            実写映画のような映像へ仕立てます。
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/story">
              思い出をつくる <span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link light-link" href="/film/momo-demo">
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
              <span>写真5枚から</span>
            </div>
          </div>
        </div>
      </section>

      <ScrollMemoryStory />

      <section className="purpose-section section-tight">
        <div className="shell">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">TWO FILM TYPES</p>
              <h2>ふたつの始まり、ふたつの結び。</h2>
            </div>
            <p>最初に、その子との今に合う映画を選びます。</p>
          </div>
          <div className="purpose-grid">
            <article className="purpose-card purpose-now">
              <span className="purpose-number">01</span>
              <div className="purpose-card-content">
                <p className="card-kicker">いまを残す思い出フィルム</p>
                <h3>いつもの日々を、未来の宝物に。</h3>
                <p className="purpose-description">散歩やお昼寝、家族を待つ後ろ姿。今を一緒に過ごしているその子の表情を映画にします。</p>
                <div className="purpose-ending"><span>COMMON ENDING</span><strong>また明日も、いつもの道を。</strong><p>家族を振り返り、並んで歩き続けるエンディング。</p></div>
              </div>
            </article>
            <article className="purpose-card purpose-thanks">
              <span className="purpose-number">02</span>
              <div className="purpose-card-content">
                <p className="card-kicker">虹の橋メモリアル</p>
                <h3>さよならよりも、ありがとうを。</h3>
                <p className="purpose-description">先に旅立ったその子へ、悲しみだけではなく、一緒に過ごせた喜びと感謝を伝えます。</p>
                <div className="purpose-ending"><span>COMMON ENDING</span><strong>少し先で、待っているね。</strong><p>空へ続く光の道を歩き、家族を振り返って旅立つエンディング。</p></div>
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
              <h2>一頭ごとに、違う映画。</h2>
            </div>
            <p>
              派手な演出よりも、その子らしいしぐさと空気を大切に。
              <br />
              ご希望に合わせて、映像の温度を整えます。
            </p>
          </div>
          <div className="film-grid">
            <article className="film-card film-card-main">
              <div className="film-still still-warm" aria-hidden="true">
                <span className="play-mark">▶</span>
                <span className="film-time">01:02</span>
              </div>
              <div className="film-meta">
                <div>
                  <p>モモと歩いた季節</p>
                  <span>Warm daily film</span>
                </div>
                <span>柴犬・12歳</span>
              </div>
            </article>
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
                  <p>またね、ルーク</p>
                  <span>Gentle memorial</span>
                </div>
                <span>ラブラドール・14歳</span>
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
            <p>映画が完成したら、WAN MEMORYのドメイン内にその子だけのページを制作します。映像、写真、物語、ご家族からの言葉が実際にどう見えるか、モモのデモサイトでご覧ください。</p>
            <Link className="button button-primary" href="/film/momo-demo">モモの完成デモを見る <span aria-hidden="true">→</span></Link>
          </div>
          <div className="demo-browser-preview" aria-hidden="true">
            <div className="demo-browser-bar"><span /><span /><span /><p>WAN MEMORY / FILM / MOMO</p></div>
            <div className="demo-browser-image"><span>PLAY SAMPLE</span></div>
            <div className="demo-browser-copy"><small>MEMORY FILM · SHIBA INU</small><strong>モモと歩いた季節</strong><p>家族になった春から、いつもの帰り道まで。</p></div>
          </div>
        </div>
      </section>

      <section className="process-section section" id="flow">
        <div className="shell">
          <p className="eyebrow">HOW IT WORKS</p>
          <div className="process-head">
            <h2>完成まで、迷わない4つのステップ。</h2>
            <p>途中保存できるので、思い出はゆっくり聞かせてください。</p>
          </div>
          <ol className="process-list">
            {[
              ["01", "映画の種類を選び、思い出を聞かせる", "『いまを残す』か『虹の橋メモリアル』を選び、写真とエピソードをお預けください。"],
              ["02", "映像コンセプト2案を受け取る", "お預かりした内容から、方向性の異なる2つの物語をご提案します。"],
              ["03", "1案を選び、詳細を確認", "選んだコンセプトを約1分の構成に整え、制作前にご確認いただきます。"],
              ["04", "映画と専用サイトを受け取る", "約1分の完成映像と、その子だけのウェブページをご家族へ共有できます。"],
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
            <p>コンセプト提案から、約1分の映画と専用サイトまで。</p>
          </div>
          <aside className="included-memory-site" aria-label="メモリーフィルムに含まれる専用ウェブサイト">
            <p className="included-label">INCLUDED IN MEMORY FILM</p>
            <div>
              <h3>一頭ごとの、専用メモリーウェブサイト。</h3>
              <p>完成した映画、タイトル、メッセージ、写真をまとめた専用ページを、WAN MEMORYのドメイン内にお客様ごとに制作します。</p>
            </div>
            <ul>
              <li>URLを開くだけで閲覧</li>
              <li>ログイン・パスワード不要</li>
              <li>動画ダウンロード非対応</li>
            </ul>
          </aside>
          <div className="pricing-grid">
            <article className="price-card price-card-featured price-card-single">
              <p className="plan-en">MEMORY FILM</p>
              <h3>メモリーフィルム</h3>
              <p className="price"><span>¥</span>29,800<small>〜</small></p>
              <p className="price-caption">選んだコンセプトを、約1分の映画に。</p>
              <ul>
                <li>映像コンセプト2案</li><li>映画タイプ別の共通エンディング</li><li>選んだ1案の詳細構成</li><li>約1分の実写風映像</li><li>ナレーション・字幕</li><li>修正2回</li><li>専用メモリーサイト</li>
              </ul>
              <Link className="button button-primary" href="/story">このプランで相談する</Link>
            </article>
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
            {[
              ["写真は何枚必要ですか？", "最低5枚から受付できます。顔の正面・横顔・全身など、15〜30枚あるとその子らしさをより丁寧に確認できます。"],
              ["AI映像で顔が変わることはありますか？", "生成表現には外見の揺らぎが生じる可能性があります。そのため自動納品はせず、担当者の確認とお客様のシーン確認を必ず行います。"],
              ["映像コンセプト2案とは何ですか？", "同じ写真とエピソードから、物語の切り口や場面構成が異なる2案をご提案します。お好きな1案を選んでいただき、約1分の映像として詳しく仕上げます。"],
              ["2案の最後もそれぞれ違いますか？", "途中の物語と場面構成は異なりますが、最後は映画の種類に合わせた共通エンディングです。『いまを残す』は家族と歩き続ける場面、『虹の橋メモリアル』は空へ続く光の道を進み、少し先で待っている気持ちを表します。"],
              ["すべての質問に答える必要がありますか？", "いいえ。答えにくい質問は飛ばせます。途中保存もできるので、準備ができた時に再開してください。"],
              ["写真や動画はAIの学習に使われますか？", "お客様の明示的な同意なく、自社モデルの学習や第三者への公開には使用しません。"],
              ["専用ウェブサイトとは何ですか？", "完成した映画、写真、メッセージをまとめたお客様専用ページです。WAN MEMORYのドメイン内に一組ずつ制作し、共有されたURLを開くだけでログインやパスワードなしでご覧いただけます。検索結果には掲載しません。"],
              ["ページの動画は保存できますか？", "動画はページ内での鑑賞専用で、ダウンロードボタンは設けず、元の動画ファイルも直接表示しません。ただし、端末の画面録画などを技術的に完全に防ぐことはできません。"],
              ["完成までどのくらいかかりますか？", "素材が揃ってから通常3〜5週間を目安にしています。内容と修正回数により前後するため、受付時に予定日をご案内します。"],
            ].map(([question, answer]) => (
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
          <p className="eyebrow light">YOUR STORY STARTS HERE</p>
          <h2>その子のことを、<br />ゆっくり聞かせてください。</h2>
          <p>すべての質問に答えなくても大丈夫です。入力内容はこの端末に自動で保存されます。</p>
          <Link className="button button-cream" href="/story">思い出づくりを始める <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
