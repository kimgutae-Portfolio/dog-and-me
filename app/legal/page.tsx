import type { Metadata } from "next";
import { InfoPage } from "../components/InfoPage";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
  description: "WAN MEMORYの販売条件と現在のモニター受付状況をご案内します。",
  alternates: { canonical: "/legal" },
};

const rows = [
  ["サービス名", "WAN MEMORY メモリーフィルム"],
  ["販売価格", "初期10組 ¥24,800（税込）／受付終了後 ¥29,800（税込）。追加オプションがある場合は契約前に個別見積りで表示します。"],
  ["商品代金以外の費用", "インターネット接続・通信に必要な費用はお客様のご負担です。追加費用が発生する場合は契約前に明示します。"],
  ["支払方法・支払時期", "現在はモニター相談受付のみで、サイト上の決済は開始していません。決済開始後は利用可能な方法と支払時期を本ページおよび最終確認画面に表示します。"],
  ["役務の提供時期", "素材が揃い、契約とお支払いが完了してから通常3〜5週間を目安に納品します。内容や修正状況により変わる場合は、契約前に予定日をご案内します。"],
  ["キャンセル・返金", "契約成立前は料金がかかりません。制作開始後は進行状況に応じ、発生済みの制作費・外部サービス費を差し引いて返金額をご案内します。納品後は、当方の不備を除き返品・返金はお受けできません。"],
  ["動作環境", "最新版のSafari、Chrome、Edgeを推奨します。通信環境や端末により映像の再生品質が異なる場合があります。"],
  ["販売事業者・運営責任者・所在地・電話番号", "決済機能の開始前に、正式な個人事業者情報と確実に連絡できる窓口を本欄へ掲載します。現在、本サイトでは相談受付のみを行い、オンラインでの契約締結・決済は行っていません。"],
] as const;

export default function LegalPage() {
  return (
    <InfoPage eyebrow="LEGAL NOTICE" title="特定商取引法に基づく表記" lead="現在はモニター相談受付の段階です。オンライン決済の開始前に、正式な事業者情報を掲載します。">
      <dl className="legal-table">{rows.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl>
      <aside className="info-note"><strong>決済開始前の確認事項</strong><p>本ページの事業者氏名、活動住所、電話番号、支払方法を正式情報へ更新し、お客様が契約前に確認できる状態にしてから決済機能を公開します。</p></aside>
      <p className="info-updated">最終更新日：2026年7月17日</p>
    </InfoPage>
  );
}
