"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Order = { petName?: string; breed?: string; age?: string; purpose?: string; style?: string; photoNames?: string[]; message?: string; orderNumber?: string; submittedAt?: string; };

const demoOrder: Order = { petName: "モモ", breed: "柴犬", age: "12歳", purpose: "日常の思い出", style: "あたたかな日常映画", photoNames: ["momo_01.jpg", "momo_02.jpg", "momo_03.jpg"], message: "これからも一緒に、ゆっくり歩こうね。", orderNumber: "KF-DEMO-0128", submittedAt: new Date().toISOString() };

export function StudioClient() {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order>(demoOrder);
  const [loaded, setLoaded] = useState(false);
  const received = searchParams.get("received") === "1";

  useEffect(() => {
    const raw = window.localStorage.getItem("kimi-film-order");
    if (raw) { try { setOrder(JSON.parse(raw)); } catch { setOrder(demoOrder); } }
    setLoaded(true);
  }, []);

  if (!loaded) return <div className="wizard-loading">制作室を準備しています…</div>;

  return (
    <main className="studio-page">
      <header className="studio-header"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">WM</span><span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span></Link><nav><Link href="/">ホーム</Link><Link href="/story">新しい相談</Link><button type="button" aria-label="通知">○</button><span className="avatar">GT</span></nav></header>
      {received && <div className="received-banner"><span aria-hidden="true">✓</span><div><strong>ご相談を受け付けました。</strong><p>担当者が内容を確認し、次に必要なものをご案内します。1次版のため外部送信はされていません。</p></div></div>}
      <div className="studio-shell">
        <div className="studio-top"><div><p className="eyebrow">YOUR FILM STUDIO</p><h1>{order.petName}ちゃんの制作室</h1><p>ここでストーリー確認から完成まで、ひとつずつ進めます。</p></div><div className="order-meta"><span>ORDER</span><strong>{order.orderNumber}</strong><small>{order.submittedAt ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(order.submittedAt)) : "受付前"}</small></div></div>
        <section className="studio-status"><div className="status-copy"><span className="status-badge">現在のステップ</span><p>01 / 05</p><h2>お申し込み内容を確認しています</h2><p>写真とエピソードを担当者が確認しています。不足がある場合はこちらでお知らせします。</p><span className="estimate">次のご連絡目安：2営業日以内</span></div><div className="status-visual" aria-hidden="true"><div className="reel-circle"><span>WM</span></div><i /><i /><i /></div></section>
        <section className="timeline-card"><div className="card-head"><div><p className="eyebrow">PRODUCTION JOURNEY</p><h2>完成までの流れ</h2></div><span>予定完成日　内容確認後にご案内</span></div><ol className="studio-timeline">{[
          ["01", "相談受付", "完了", true], ["02", "素材確認", "確認中", true], ["03", "ストーリー確認", "準備前", false], ["04", "シーン確認", "準備前", false], ["05", "映画の完成", "準備前", false]
        ].map(([number, title, state, active]) => <li className={active ? "active" : ""} key={String(number)}><span>{active ? "✓" : number}</span><div><strong>{title}</strong><small>{state}</small></div></li>)}</ol></section>
        <div className="studio-grid"><section className="studio-card"><div className="card-head"><div><p className="eyebrow">YOUR DOG</p><h2>お預かりした内容</h2></div><Link href="/story">編集</Link></div><div className="pet-summary"><div className="pet-photo" aria-hidden="true"><span>{order.petName?.slice(0, 1)}</span></div><div><h3>{order.petName} <small>{order.breed}・{order.age}</small></h3><p>{order.purpose}</p><dl><div><dt>映像の雰囲気</dt><dd>{order.style}</dd></div><div><dt>写真</dt><dd>{order.photoNames?.length ?? 0}枚</dd></div></dl></div></div>{order.message && <blockquote>「{order.message}」</blockquote>}</section><aside className="studio-card message-card"><p className="eyebrow">MESSAGE</p><h2>担当ディレクター</h2><div className="director"><span>準</span><div><strong>担当者を準備中です</strong><small>内容確認後にご紹介します</small></div></div><p>ご不安なことや、あとから思い出したことはいつでも追加できます。</p><button className="button button-outline" type="button" disabled>メッセージ機能（次期）</button></aside></div>
        <div className="studio-footnote"><span aria-hidden="true">i</span><p><strong>1次開発版について</strong>この制作室は受注体験を確認するためのデモです。認証・決済・実ファイル送信・担当者メッセージは次の開発段階で接続します。</p></div>
      </div>
    </main>
  );
}
