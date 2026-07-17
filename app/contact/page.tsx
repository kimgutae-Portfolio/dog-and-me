import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { START_STORY_HREF } from "../lib/site";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "WAN MEMORYへのご相談・お問い合わせ方法をご案内します。",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <InfoPage eyebrow="CONTACT" title="お問い合わせ" lead="ご検討中のことも、制作中のことも、分からないままで大丈夫です。">
      <section>
        <h2>制作前のご相談</h2>
        <p>愛犬のお名前とメールアドレスを登録すると、映画の種類や写真についてゆっくり入力できます。送信までは料金は発生せず、内容と納期をご確認いただいてから制作へ進みます。</p>
        <Link className="button button-primary" href={START_STORY_HREF}>無料相談を始める →</Link>
      </section>
      <section>
        <h2>すでにご登録済みの方</h2>
        <p>制作中の追加写真、ご質問、映像の修正依頼は、ログイン後の制作室から担当者へお送りください。注文ごとの履歴として安全に保管されます。</p>
        <Link className="button button-outline" href="/studio">制作室を開く →</Link>
      </section>
      <aside className="info-note"><strong>現在の受付について</strong><p>現在はモニター相談受付中です。サイト上での決済開始前に、公開お問い合わせ窓口と事業者情報を本ページおよび「特定商取引法に基づく表記」へ掲載します。</p></aside>
    </InfoPage>
  );
}
