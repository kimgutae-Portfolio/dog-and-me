import type { Metadata } from "next";
import { InfoPage } from "../components/InfoPage";
import { SUPPORT_EMAIL } from "../lib/site";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
  description: "WAN MEMORYの販売条件と現在のモニター受付状況をご案内します。",
  alternates: { canonical: "/legal" },
};

const rows = [
  ["販売事業者・運営責任者", "ご請求に応じて、お申し込みの意思決定に先立って遅滞なく電子メールで開示します。お問い合わせページからご請求ください。"],
  ["所在地・電話番号", "ご請求に応じて、お申し込みの意思決定に先立って遅滞なく電子メールで開示します。お問い合わせページからご請求ください。"],
  ["メールアドレス", SUPPORT_EMAIL],
  ["サービス名", "WAN MEMORY メモリーフィルム"],
  ["販売価格", "初期10組 ¥24,800（税込）／受付終了後 ¥29,800（税込）。追加オプションがある場合は契約前に個別見積りで表示します。"],
  ["商品代金以外の費用", "インターネット接続・通信に必要な費用はお客様のご負担です。追加費用が発生する場合は契約前に明示します。"],
  ["支払方法・支払時期", "現在、フォーム送信は制作相談の受付であり、送信時点では料金は発生しません。カード決済の受付開始後は、お申し込み内容、確定料金、納期をご確認いただいたうえで、制作開始前にクレジットカード（Stripe）でお支払いいただきます。"],
  ["役務の提供時期", "素材が揃い、契約とお支払いが完了してから通常3〜5週間を目安に納品します。内容や修正状況により変わる場合は、契約前に予定日をご案内します。"],
  ["キャンセル・返金", "契約成立前は料金がかかりません。制作開始後は進行状況に応じ、発生済みの制作費・外部サービス費を差し引いて返金額をご案内します。納品後は、当方の不備を除き返品・返金はお受けできません。"],
  ["動作環境", "最新版のSafari、Chrome、Edgeを推奨します。通信環境や端末により映像の再生品質が異なる場合があります。"],
] as const;

export default function LegalPage() {
  return (
    <InfoPage eyebrow="LEGAL NOTICE" title="特定商取引法に基づく表記" lead="WAN MEMORYの販売事業者、料金、お支払い、納品およびキャンセル条件をご案内します。">
      <dl className="legal-table">{rows.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl>
      <aside className="info-note"><strong>販売事業者情報の開示について</strong><p>販売事業者名、運営責任者名、所在地および電話番号は、ご請求に応じて、お申し込みの意思決定に先立って遅滞なく電子メールで開示します。お問い合わせページからご連絡ください。</p></aside>
      <p className="info-updated">最終更新日：2026年7月23日</p>
    </InfoPage>
  );
}
