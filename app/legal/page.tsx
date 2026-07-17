import type { Metadata } from "next";
import { InfoPage } from "../components/InfoPage";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
  description: "WAN MEMORYの販売条件と現在のモニター受付状況をご案内します。",
  alternates: { canonical: "/legal" },
};

const rows = [
  ["販売事業者", "金具泰"],
  ["運営責任者", "金具泰"],
  ["所在地", "大阪府堺市中区327-47"],
  ["電話番号", "080-8530-7568"],
  ["サービス名", "WAN MEMORY メモリーフィルム"],
  ["販売価格", "初期10組 ¥24,800（税込）／受付終了後 ¥29,800（税込）。追加オプションがある場合は契約前に個別見積りで表示します。"],
  ["商品代金以外の費用", "インターネット接続・通信に必要な費用はお客様のご負担です。追加費用が発生する場合は契約前に明示します。"],
  ["支払方法・支払時期", "クレジットカード決済（Stripe）。お申し込み内容、確定料金、納期をご確認いただいた後、制作開始前にお支払いいただきます。"],
  ["役務の提供時期", "素材が揃い、契約とお支払いが完了してから通常3〜5週間を目安に納品します。内容や修正状況により変わる場合は、契約前に予定日をご案内します。"],
  ["キャンセル・返金", "契約成立前は料金がかかりません。制作開始後は進行状況に応じ、発生済みの制作費・外部サービス費を差し引いて返金額をご案内します。納品後は、当方の不備を除き返品・返金はお受けできません。"],
  ["動作環境", "最新版のSafari、Chrome、Edgeを推奨します。通信環境や端末により映像の再生品質が異なる場合があります。"],
] as const;

export default function LegalPage() {
  return (
    <InfoPage eyebrow="LEGAL NOTICE" title="特定商取引法に基づく表記" lead="WAN MEMORYの販売事業者、料金、お支払い、納品およびキャンセル条件をご案内します。">
      <dl className="legal-table">{rows.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl>
      <aside className="info-note"><strong>お問い合わせ</strong><p>サービス内容、納品、キャンセルについては、お問い合わせページまたは電話番号 080-8530-7568 までご連絡ください。</p></aside>
      <p className="info-updated">最終更新日：2026年7月17日</p>
    </InfoPage>
  );
}
