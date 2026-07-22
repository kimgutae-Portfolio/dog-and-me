import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { StartStoryLink } from "../components/StartStoryLink";
import { SUPPORT_EMAIL } from "../lib/site";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "WAN MEMORYへのご相談・お問い合わせ方法をご案内します。",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <InfoPage eyebrow="CONTACT" title="お問い合わせ" lead="サービス内容のご質問から、制作中のご相談までお気軽にお問い合わせください。">
      <section>
        <h2>メモリーフィルムのお申し込み</h2>
        <p>現在、初期10組限定のモニター価格でご相談を受け付けています。愛犬のことや残したい思い出をフォームからゆっくりお聞かせください。</p>
        <StartStoryLink className="button button-primary">思い出づくりを始める →</StartStoryLink>
      </section>
      <section>
        <h2>すでにご登録済みの方</h2>
        <p>制作中の追加写真、ご質問、映像の修正依頼は、ログイン後の制作室から担当者へお送りください。注文ごとの履歴として安全に保管されます。</p>
        <Link className="button button-outline" href="/studio">制作室を開く →</Link>
      </section>
      <section>
        <h2>メールでのお問い合わせ</h2>
        <p>サービス内容、制作のご相談、納品やキャンセルについては、下記のメールアドレスへご連絡ください。</p>
        <a className="button button-outline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL} →</a>
      </section>
      <section>
        <h2>電話番号の開示をご希望の方</h2>
        <p>特定商取引法に基づく電話番号は、ご請求に応じて、お申し込みの意思決定に先立って遅滞なく開示します。下のメールから「電話番号の開示希望」とお送りください。</p>
        <a className="button button-outline" href={`mailto:${SUPPORT_EMAIL}?subject=WAN%20MEMORY%20%E9%9B%BB%E8%A9%B1%E7%95%AA%E5%8F%B7%E3%81%AE%E9%96%8B%E7%A4%BA%E5%B8%8C%E6%9C%9B`}>メールで開示を請求する →</a>
      </section>
      <aside className="info-note"><strong>運営者情報</strong><p>販売事業者・運営責任者：金具泰<br />所在地：〒599-8272 大阪府堺市中区深井中町327-47</p></aside>
    </InfoPage>
  );
}
