"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type { Delivery, FilmConcept, MemoryOrder, OrderAsset, OrderMessage, RevisionRequest } from "../lib/supabase/types";
import { ORDER_STATUS_LABELS } from "../lib/supabase/types";
import { uploadOrderImages } from "../lib/supabase/uploads";

const journeySteps = [
  ["受付", "写真とお話をお預かり"],
  ["素材確認", "担当者が内容を確認"],
  ["2案提案", "異なる物語をご提案"],
  ["1案選択", "お客様が方向性を決定"],
  ["映像制作", "約1分の映画を制作"],
  ["確認・修正", "完成前の最終確認"],
  ["お届け", "映画と専用サイトを納品"],
] as const;

const statusStep: Record<MemoryOrder["status"], number> = {
  awaiting_materials: 0,
  materials_submitted: 0,
  reviewing_materials: 1,
  concepts_ready: 2,
  concept_selected: 3,
  production: 4,
  customer_review: 5,
  revision_requested: 5,
  quality_check: 5,
  delivered: 6,
  cancelled: 0,
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value)) : "確認後にご案内";
}

export function StudioClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState<MemoryOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [assets, setAssets] = useState<OrderAsset[]>([]);
  const [concepts, setConcepts] = useState<FilmConcept[]>([]);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [messageBody, setMessageBody] = useState("");
  const [revisionCategory, setRevisionCategory] = useState("映像の動き");
  const [revisionBody, setRevisionBody] = useState("");
  const received = searchParams.get("received") === "1";

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/studio");
  }, [authLoading, router, user]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: ordersError } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (ordersError) {
      setError("制作室の情報を読み込めませんでした。");
      setLoading(false);
      return;
    }
    const loadedOrders = (data ?? []) as MemoryOrder[];
    setOrders(loadedOrders);
    const requested = searchParams.get("order");
    const nextId = loadedOrders.some((order) => order.id === requested) ? requested! : loadedOrders[0]?.id ?? "";
    setSelectedOrderId((current) => current && loadedOrders.some((order) => order.id === current) ? current : nextId);
    setLoading(false);
  }, [searchParams, user]);

  const loadDetails = useCallback(async (orderId: string) => {
    if (!orderId) return;
    const supabase = getSupabaseBrowserClient();
    const [assetResult, conceptResult, deliveryResult, messageResult, revisionResult] = await Promise.all([
      supabase.from("assets").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("concepts").select("*").eq("order_id", orderId).eq("status", "published").order("slot"),
      supabase.from("deliveries").select("*").eq("order_id", orderId).maybeSingle(),
      supabase.from("messages").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("revision_requests").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    ]);
    setAssets((assetResult.data ?? []) as OrderAsset[]);
    setConcepts((conceptResult.data ?? []) as FilmConcept[]);
    setDelivery((deliveryResult.data as Delivery | null) ?? null);
    setMessages((messageResult.data ?? []) as OrderMessage[]);
    setRevisions((revisionResult.data ?? []) as RevisionRequest[]);
    setVideoUrl("");
  }, []);

  useEffect(() => {
    const timer = user ? window.setTimeout(() => loadOrders(), 0) : undefined;
    return () => { if (timer) window.clearTimeout(timer); };
  }, [loadOrders, user]);
  useEffect(() => {
    const timer = selectedOrderId ? window.setTimeout(() => loadDetails(selectedOrderId), 0) : undefined;
    return () => { if (timer) window.clearTimeout(timer); };
  }, [loadDetails, selectedOrderId]);

  const order = useMemo(() => orders.find((item) => item.id === selectedOrderId) ?? null, [orders, selectedOrderId]);
  const finalAsset = useMemo(() => delivery ? assets.find((asset) => asset.id === delivery.final_asset_id) ?? null : null, [assets, delivery]);

  useEffect(() => {
    if (!finalAsset) return;
    getSupabaseBrowserClient().storage.from("order-assets").createSignedUrl(finalAsset.storage_path, 3600).then(({ data }) => setVideoUrl(data?.signedUrl ?? ""));
  }, [finalAsset]);

  const currentStep = order ? statusStep[order.status] : 0;
  const selectedConcept = order?.selected_concept_slot ? concepts.find((concept) => concept.slot === order.selected_concept_slot) : null;
  const sourceAssets = assets.filter((asset) => asset.category === "source_image");

  const selectConcept = async (slot: "A" | "B") => {
    if (!order) return;
    setError("");
    const { error: selectError } = await getSupabaseBrowserClient().rpc("select_memory_concept", { p_order_id: order.id, p_slot: slot });
    if (selectError) { setError("コンセプトを選択できませんでした。"); return; }
    setNotice(`コンセプト${slot}で制作を進めます。`);
    await loadOrders();
  };

  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!user || !order) return;
    const files = Array.from(event.target.files ?? []).slice(0, 20);
    if (!files.length) return;
    setUploading(true);
    setUploadProgress(0);
    setError("");
    try {
      await uploadOrderImages(getSupabaseBrowserClient(), user.id, order.id, files, (completed, total) => setUploadProgress(Math.round((completed / total) * 100)));
      setNotice(`${files.length}枚の写真を追加しました。`);
      await loadDetails(order.id);
    } catch (caught) {
      console.error(caught);
      setError("写真を追加できませんでした。形式と通信状態をご確認ください。");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !order || !messageBody.trim()) return;
    const { error: messageError } = await getSupabaseBrowserClient().from("messages").insert({ order_id: order.id, sender_id: user.id, body: messageBody.trim() });
    if (messageError) { setError("メッセージを送信できませんでした。"); return; }
    setMessageBody("");
    await loadDetails(order.id);
  };

  const requestRevision = async (event: FormEvent) => {
    event.preventDefault();
    if (!order || !revisionBody.trim()) return;
    const { error: revisionError } = await getSupabaseBrowserClient().rpc("request_order_revision", { p_order_id: order.id, p_category: revisionCategory, p_body: revisionBody.trim() });
    if (revisionError) { setError("修正依頼を送信できませんでした。"); return; }
    setRevisionBody("");
    setNotice("修正依頼を受け付けました。");
    await Promise.all([loadOrders(), loadDetails(order.id)]);
  };

  if (authLoading || loading || !user) return <div className="wizard-loading">制作室を準備しています…</div>;

  return (
    <main className="studio-page">
      <header className="studio-header">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">WM</span><span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span></Link>
        <nav><Link href="/">ホーム</Link><Link href="/story">新しい相談</Link>{profile?.role === "admin" && <Link href="/admin">運営管理</Link>}<button type="button" onClick={async () => { await signOut(); router.push("/"); }}>ログアウト</button><span className="avatar">{(profile?.full_name || user.email || "U").slice(0, 1).toUpperCase()}</span></nav>
      </header>
      {received && <div className="received-banner"><span aria-hidden="true">✓</span><div><strong>ご相談と写真を受け付けました。</strong><p>ここから追加写真、コンセプト選択、映像確認、お届けまで進められます。</p></div></div>}
      <div className="studio-shell">
        <div className="studio-account-bar"><div><small>ACCOUNT</small><strong>{profile?.full_name || user.email}</strong></div>{orders.length > 1 && <label><span>制作中の映画</span><select value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>{orders.map((item) => <option value={item.id} key={item.id}>{item.pet_name} · {item.order_number}</option>)}</select></label>}</div>

        {error && <p className="studio-alert error" role="alert">{error}</p>}
        {notice && <p className="studio-alert" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></p>}

        {!order ? <section className="studio-empty"><p className="eyebrow">YOUR FILM STUDIO</p><h1>最初の思い出を<br />聞かせてください。</h1><p>お申し込み後、写真の追加から完成した映画のお届けまで、この制作室でご案内します。</p><Link className="button button-primary" href="/story">思い出づくりを始める →</Link></section> : <>
          <div className="studio-top"><div><p className="eyebrow">YOUR FILM STUDIO</p><h1>{order.pet_name}ちゃんの制作室</h1><p>写真の追加から完成まで、ひとつずつ進めます。</p></div><div className="order-meta"><span>ORDER</span><strong>{order.order_number}</strong><small>受付 {formatDate(order.created_at)}</small><small>料金 ¥{new Intl.NumberFormat("ja-JP").format(order.quoted_price)}（税込）</small><small>お支払い {order.payment_status === "paid" ? "入金確認済み" : order.payment_status === "invoice_sent" ? "ご案内済み" : order.payment_status === "refunded" ? "返金済み" : "内容確認後にご案内"}</small></div></div>

          <section className="studio-status"><div className="status-copy"><span className="status-badge">現在のステップ {currentStep + 1} / {journeySteps.length}</span><h2>{ORDER_STATUS_LABELS[order.status]}</h2><p>{order.status === "delivered" ? "大切な映画をいつでもこちらでご覧いただけます。" : order.status === "concepts_ready" ? "方向性の異なる2つの物語から、その子らしい1案を選んでください。" : "進行が変わると、この制作室でお知らせします。追加したい思い出や写真はいつでもお送りください。"}</p><span className="estimate">予定完成日：{formatDate(order.due_date)}</span></div><div className="status-visual" aria-hidden="true"><div className="reel-circle"><span>WM</span></div><i /><i /><i /></div></section>

          <section className="timeline-card"><div className="card-head"><div><p className="eyebrow">PRODUCTION JOURNEY</p><h2>受付からお届けまで</h2></div><span>{ORDER_STATUS_LABELS[order.status]}</span></div><ol className="studio-timeline studio-timeline-seven">{journeySteps.map(([title, copy], index) => <li className={index <= currentStep ? "active" : ""} key={title}><span>{index < currentStep ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><small>{copy}</small></div></li>)}</ol></section>

          {concepts.length > 0 && currentStep >= 2 && <section className="concept-section studio-card"><div className="card-head"><div><p className="eyebrow">CHOOSE YOUR FILM CONCEPT</p><h2>2つの物語から、1つを選ぶ</h2></div><span>選択後、約1分の詳しい構成へ進みます</span></div><div className="concept-grid">{concepts.map((concept) => <button type="button" disabled={order.status !== "concepts_ready" && order.status !== "concept_selected"} className={order.selected_concept_slot === concept.slot ? "concept-option selected" : "concept-option"} onClick={() => selectConcept(concept.slot)} key={concept.id}><span className="concept-label">CONCEPT {concept.slot}</span><strong>{concept.title}</strong><small>{concept.tone}</small><p>{concept.summary}</p><ol>{concept.scenes.map((scene, index) => <li key={`${concept.id}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{scene}</li>)}</ol><i aria-hidden="true">{order.selected_concept_slot === concept.slot ? "✓" : ""}</i></button>)}</div>{selectedConcept && <div className="concept-confirm"><p><span>選択した物語</span><strong>{selectedConcept.title}</strong></p><span className="status-badge">選択済み</span></div>}</section>}

          {delivery && <section className="delivery-card"><div><p className="eyebrow light">YOUR FILM IS READY</p><h2>{delivery.title}</h2><p>{delivery.customer_message || `${order.pet_name}ちゃんとの時間を、一本の映画に仕上げました。`}</p><Link className="button button-cream" href={`/film/${order.id}`}>専用メモリーサイトを見る →</Link></div><div className="delivery-player">{videoUrl ? <video src={videoUrl} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline onContextMenu={(event) => event.preventDefault()} /> : <span>映像を準備しています…</span>}<small>閲覧専用 · ダウンロードボタンは表示されません</small></div></section>}

          <div className="studio-grid">
            <section className="studio-card"><div className="card-head"><div><p className="eyebrow">YOUR DOG &amp; MATERIALS</p><h2>お預かりした内容</h2></div><span>{sourceAssets.length}枚</span></div><div className="pet-summary"><div className="pet-photo"><span>{order.pet_name.slice(0, 1)}</span></div><div><h3>{order.pet_name} <small>{order.breed}・{order.age_text}</small></h3><p>{order.purpose}</p><dl><div><dt>映像の雰囲気</dt><dd>{order.style}</dd></div><div><dt>写真</dt><dd>{sourceAssets.length}枚</dd></div></dl></div></div>{order.message_to_pet && <blockquote>「{order.message_to_pet}」</blockquote>}<label className={uploading ? "studio-upload-button disabled" : "studio-upload-button"}><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple disabled={uploading} onChange={addPhotos} /><span>＋ 写真を追加する</span><small>{uploading ? `送信中 ${uploadProgress}%` : "HEICは自動でJPGに変換 · 最大20枚ずつ"}</small></label></section>

            <aside className="studio-card message-card"><p className="eyebrow">MESSAGE</p><h2>担当者とのメッセージ</h2><div className="message-thread">{messages.length ? messages.slice(-5).map((message) => <article className={message.sender_id === user.id ? "mine" : ""} key={message.id}><small>{message.sender_id === user.id ? "あなた" : "担当ディレクター"} · {formatDate(message.created_at)}</small><p>{message.body}</p></article>) : <p className="message-empty">追加したい思い出やご質問をこちらから送れます。</p>}</div><form className="message-form" onSubmit={sendMessage}><textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} rows={3} maxLength={3000} placeholder="担当者へ伝えたいこと" /><button className="button button-outline" type="submit" disabled={!messageBody.trim()}>メッセージを送る</button></form></aside>
          </div>

          {(order.status === "customer_review" || order.status === "delivered" || revisions.length > 0) && <section className="studio-card revision-card"><div className="card-head"><div><p className="eyebrow">REVISION REQUEST</p><h2>映像の修正について</h2></div><span>修正2回までプラン内</span></div>{revisions.length > 0 && <div className="revision-history">{revisions.map((revision) => <article key={revision.id}><span>{revision.status === "open" ? "対応中" : "反映済み"}</span><strong>{revision.category}</strong><p>{revision.body}</p></article>)}</div>}{(order.status === "customer_review" || order.status === "delivered") && <form className="revision-form" onSubmit={requestRevision}><select value={revisionCategory} onChange={(event) => setRevisionCategory(event.target.value)}><option>映像の動き</option><option>愛犬の外見</option><option>リード・服・小物</option><option>ナレーション・字幕</option><option>その他</option></select><textarea required rows={4} value={revisionBody} onChange={(event) => setRevisionBody(event.target.value)} placeholder="例：リードが2本に見える場面を、1本だけ自然に首輪へつながるよう修正してください。" /><button className="button button-primary" type="submit">修正を依頼する →</button></form>}</section>}
        </>}
      </div>
    </main>
  );
}
