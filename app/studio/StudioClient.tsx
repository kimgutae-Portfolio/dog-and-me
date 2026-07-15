"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Order = { petName?: string; breed?: string; age?: string; purpose?: string; style?: string; photoNames?: string[]; message?: string; orderNumber?: string; submittedAt?: string; };

const demoOrder: Order = { petName: "モモ", breed: "柴犬", age: "12歳", purpose: "いまを残す", style: "あたたかな日常映画", photoNames: ["momo_01.jpg", "momo_02.jpg", "momo_03.jpg"], message: "これからも一緒に、ゆっくり歩こうね。", orderNumber: "KF-DEMO-0128", submittedAt: new Date().toISOString() };

const concepts = [
  { id: "seasons", label: "CONCEPT A", title: "モモと歩いた四季", tone: "やさしく、映画のように", copy: "家族になった春から、いつもの帰り道まで。季節の移ろいとともにモモとの時間をたどります。", scenes: ["出会った春", "夏の散歩道", "窓辺で眠る秋"] },
  { id: "home", label: "CONCEPT B", title: "モモのいる家", tone: "自然体のドキュメンタリー", copy: "朝の足音、好きなおもちゃ、家族を待つ後ろ姿。特別ではない一日を、かけがえのない物語にします。", scenes: ["いつもの朝", "お気に入りの場所", "家族を待つ時間"] },
] as const;

const commonEndings = {
  memory: { label: "いまを残す · 2案共通", title: "また明日も、いつもの道を。", copy: "夕暮れの散歩道で家族を振り返り、並んで歩き続けます。今もこれからも続く時間を表すエンディングです。", line: "明日もまた、一緒に歩こう。" },
  memorial: { label: "虹の橋メモリアル · 2案共通", title: "少し先で、待っているね。", copy: "穏やかな光の草原から空へ続く道を歩き、家族を一度振り返って光の向こうへ。先に行って待っている気持ちを表します。", line: "先に行って、少しだけ待っているね。" },
} as const;

export function StudioClient() {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order>(demoOrder);
  const [selectedConcept, setSelectedConcept] = useState<(typeof concepts)[number]["id"]>("seasons");
  const [conceptConfirmed, setConceptConfirmed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const received = searchParams.get("received") === "1";

  useEffect(() => {
    const raw = window.localStorage.getItem("kimi-film-order");
    if (raw) { try { setOrder(JSON.parse(raw)); } catch { setOrder(demoOrder); } }
    const savedConcept = window.localStorage.getItem("wan-memory-concept");
    if (savedConcept === "seasons" || savedConcept === "home") { setSelectedConcept(savedConcept); setConceptConfirmed(true); }
    setLoaded(true);
  }, []);

  if (!loaded) return <div className="wizard-loading">制作室を準備しています…</div>;

  const selected = concepts.find((concept) => concept.id === selectedConcept) ?? concepts[0];
  const isMemorial = order.purpose === "虹の橋メモリアル" || order.purpose === "お別れ・メモリアル";
  const commonEnding = isMemorial ? commonEndings.memorial : commonEndings.memory;
  const endingNotice = <div className={isMemorial ? "common-ending-card memorial" : "common-ending-card"}><span>COMMON ENDING</span><div><small>{commonEnding.label}</small><strong>{commonEnding.title}</strong><p>{commonEnding.copy}</p><blockquote>「{commonEnding.line}」</blockquote></div></div>;
  const journey: Array<[string, string, string, boolean]> = received ? [
    ["01", "素材受付", "受付完了", true], ["02", "コンセプト2案", "準備中", false], ["03", "1案を選択", "準備前", false], ["04", "約1分の制作", "準備前", false], ["05", "映画とサイト", "準備前", false],
  ] : [
    ["01", "素材受付", "完了", true], ["02", "コンセプト2案", "確認できます", true], ["03", "1案を選択", conceptConfirmed ? "完了" : "選択待ち", conceptConfirmed], ["04", "約1分の制作", "準備前", false], ["05", "映画とサイト", "準備前", false],
  ];

  return (
    <main className="studio-page">
      <header className="studio-header"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">WM</span><span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span></Link><nav><Link href="/">ホーム</Link><Link href="/story">新しい相談</Link><button type="button" aria-label="通知">○</button><span className="avatar">GT</span></nav></header>
      {received && <div className="received-banner"><span aria-hidden="true">✓</span><div><strong>ご相談を受け付けました。</strong><p>担当者が内容を確認し、次に必要なものをご案内します。1次版のため外部送信はされていません。</p></div></div>}
      <div className="studio-shell">
        <div className="studio-top"><div><p className="eyebrow">YOUR FILM STUDIO</p><h1>{order.petName}ちゃんの制作室</h1><p>ここでストーリー確認から完成まで、ひとつずつ進めます。</p></div><div className="order-meta"><span>ORDER</span><strong>{order.orderNumber}</strong><small>{order.submittedAt ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(order.submittedAt)) : "受付前"}</small></div></div>
        <section className="studio-status"><div className="status-copy"><span className="status-badge">現在のステップ</span><p>{received ? "01 / 05" : "02 / 05"}</p><h2>{received ? "お申し込み内容を確認しています" : "映像コンセプトを2案ご用意しました"}</h2><p>{received ? "写真とエピソードを担当者が確認しています。不足がある場合はこちらでお知らせします。" : "方向性の異なる2つの物語から、モモちゃんらしいと感じる1案を選んでください。"}</p><span className="estimate">{received ? "次のご連絡目安：2営業日以内" : "選択後、約1分の詳細構成を制作します"}</span></div><div className="status-visual" aria-hidden="true"><div className="reel-circle"><span>WM</span></div><i /><i /><i /></div></section>
        <section className="timeline-card"><div className="card-head"><div><p className="eyebrow">PRODUCTION JOURNEY</p><h2>完成までの流れ</h2></div><span>予定完成日　内容確認後にご案内</span></div><ol className="studio-timeline">{journey.map(([number, title, state, active]) => <li className={active ? "active" : ""} key={number}><span>{active ? "✓" : number}</span><div><strong>{title}</strong><small>{state}</small></div></li>)}</ol></section>
        {!received ? <section className="concept-section studio-card"><div className="card-head"><div><p className="eyebrow">CHOOSE YOUR FILM CONCEPT</p><h2>2つの物語から、1つを選ぶ</h2></div><span>途中の物語は異なりますが、最後は映画タイプに合わせた共通エンディングです</span></div><div className="concept-grid">{concepts.map((concept) => <button type="button" className={selectedConcept === concept.id ? "concept-option selected" : "concept-option"} onClick={() => { setSelectedConcept(concept.id); setConceptConfirmed(false); }} key={concept.id}><span className="concept-label">{concept.label}</span><strong>{concept.title}</strong><small>{concept.tone}</small><p>{concept.copy}</p><ol>{concept.scenes.map((scene, index) => <li key={scene}><span>{String(index + 1).padStart(2, "0")}</span>{scene}</li>)}</ol><i aria-hidden="true">{selectedConcept === concept.id ? "✓" : ""}</i></button>)}</div>{endingNotice}<div className="concept-confirm"><p><span>選択中</span><strong>{selected.title}</strong></p><button type="button" className="button button-primary" onClick={() => { window.localStorage.setItem("wan-memory-concept", selected.id); setConceptConfirmed(true); }}>{conceptConfirmed ? "このコンセプトを選択しました ✓" : "このコンセプトで進める →"}</button></div></section> : <section className="concept-section studio-card concept-waiting"><p className="eyebrow">NEXT STEP</p><h2>コンセプト2案を準備します</h2><p>お預かりした内容の確認後、切り口の異なる2つの物語をこの制作室にお届けします。好きな1案を選んでから映像制作が始まります。</p>{endingNotice}</section>}
        <div className="studio-grid"><section className="studio-card"><div className="card-head"><div><p className="eyebrow">YOUR DOG</p><h2>お預かりした内容</h2></div><Link href="/story">編集</Link></div><div className="pet-summary"><div className="pet-photo" aria-hidden="true"><span>{order.petName?.slice(0, 1)}</span></div><div><h3>{order.petName} <small>{order.breed}・{order.age}</small></h3><p>{order.purpose}</p><dl><div><dt>映像の雰囲気</dt><dd>{order.style}</dd></div><div><dt>写真</dt><dd>{order.photoNames?.length ?? 0}枚</dd></div></dl></div></div>{order.message && <blockquote>「{order.message}」</blockquote>}</section><aside className="studio-card message-card"><p className="eyebrow">MESSAGE</p><h2>担当ディレクター</h2><div className="director"><span>準</span><div><strong>担当者を準備中です</strong><small>内容確認後にご紹介します</small></div></div><p>ご不安なことや、あとから思い出したことはいつでも追加できます。</p><button className="button button-outline" type="button" disabled>メッセージ機能（次期）</button></aside></div>
        <div className="studio-footnote"><span aria-hidden="true">i</span><p><strong>1次開発版について</strong>この制作室は受注体験を確認するためのデモです。認証・決済・実ファイル送信・担当者メッセージは次の開発段階で接続します。</p></div>
      </div>
    </main>
  );
}
