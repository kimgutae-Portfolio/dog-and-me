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
      <section>
        <h2>お電話でのお問い合わせ</h2>
        <p>サービス内容、納品、キャンセルについてのお問い合わせを受け付けています。</p>
        <a className="contact-phone" href="tel:08085307568">080-8530-7568</a>
      </section>
      <aside className="info-note"><strong>運営者情報</strong><p>販売事業者・運営責任者：金具泰<br />所在地：〒599-8272 大阪府堺市中区深井中町327-47</p></aside>
    </InfoPage>
  );
}
