import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/InfoPage";
import { StartStoryLink } from "../components/StartStoryLink";
import {
  BUSINESS_NAME,
  BUSINESS_OPERATOR,
  SUPPORT_EMAIL,
} from "../lib/site";

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
        <h2>お問い合わせ窓口</h2>
        <p>サービス内容、制作のご相談、納品、キャンセルについては、メールでご連絡ください。制作中のご連絡は、注文履歴が残る制作室のメッセージをご利用いただくとスムーズです。</p>
        <div className="info-actions">
          <a className="button button-outline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL} →</a>
        </div>
        <p><small>運営：{BUSINESS_OPERATOR}（屋号：{BUSINESS_NAME}）</small></p>
      </section>
    </InfoPage>
  );
}
