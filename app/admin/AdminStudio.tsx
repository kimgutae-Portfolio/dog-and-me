"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type { FilmConcept, MemoryOrder, OrderAsset, Profile } from "../lib/supabase/types";
import { ORDER_STATUS_LABELS, type OrderStatus } from "../lib/supabase/types";

type ConceptDraft = { title: string; tone: string; summary: string; scenes: string };
const emptyConcept: ConceptDraft = { title: "", tone: "", summary: "", scenes: "" };

const statusOptions = Object.entries(ORDER_STATUS_LABELS) as Array<[OrderStatus, string]>;

function safeExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
}

export function AdminStudio() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState<MemoryOrder[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [concepts, setConcepts] = useState<FilmConcept[]>([]);
  const [conceptA, setConceptA] = useState<ConceptDraft>(emptyConcept);
  const [conceptB, setConceptB] = useState<ConceptDraft>(emptyConcept);
  const [status, setStatus] = useState<OrderStatus>("materials_submitted");
  const [paymentStatus, setPaymentStatus] = useState<MemoryOrder["payment_status"]>("pending");
  const [dueDate, setDueDate] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [deliveryTitle, setDeliveryTitle] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/admin");
  }, [authLoading, router, user]);

  const loadOrders = useCallback(async () => {
    if (!user || profile?.role !== "admin") return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const [ordersResult, profilesResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,email,full_name,role"),
    ]);
    if (ordersResult.error) setError("注文一覧を読み込めませんでした。");
    const loaded = (ordersResult.data ?? []) as MemoryOrder[];
    setOrders(loaded);
    setCustomers((profilesResult.data ?? []) as Profile[]);
    setSelectedOrderId((current) => current || loaded[0]?.id || "");
    setLoading(false);
  }, [profile?.role, user]);

  const loadConcepts = useCallback(async (orderId: string) => {
    if (!orderId) return;
    const { data } = await getSupabaseBrowserClient().from("concepts").select("*").eq("order_id", orderId).order("slot");
    const loaded = (data ?? []) as FilmConcept[];
    setConcepts(loaded);
    const toDraft = (concept?: FilmConcept): ConceptDraft => concept ? { title: concept.title, tone: concept.tone, summary: concept.summary, scenes: concept.scenes.join("\n") } : emptyConcept;
    setConceptA(toDraft(loaded.find((concept) => concept.slot === "A")));
    setConceptB(toDraft(loaded.find((concept) => concept.slot === "B")));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (profile?.role === "admin") loadOrders();
      else if (!authLoading) setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, loadOrders, profile?.role]);

  const order = useMemo(() => orders.find((item) => item.id === selectedOrderId) ?? null, [orders, selectedOrderId]);
  const customer = useMemo(() => customers.find((item) => item.id === order?.user_id), [customers, order?.user_id]);

  useEffect(() => {
    if (!order) return;
    const timer = window.setTimeout(() => {
      setStatus(order.status);
      setPaymentStatus(order.payment_status);
      setDueDate(order.due_date ?? "");
      setAdminNotes(order.admin_notes ?? "");
      setDeliveryTitle(`${order.pet_name}との映画`);
      setDeliveryMessage(`${order.pet_name}ちゃんとの大切な時間を、一本の映画に仕上げました。`);
      loadConcepts(order.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConcepts, order]);

  const visibleOrders = filter === "all" ? orders : orders.filter((item) => item.status === filter);

  const saveOrder = async () => {
    if (!order) return;
    setSaving(true);
    setError("");
    const { error: updateError } = await getSupabaseBrowserClient().from("orders").update({ status, payment_status: paymentStatus, due_date: dueDate || null, admin_notes: adminNotes || null, stage_updated_at: new Date().toISOString() }).eq("id", order.id);
    if (updateError) setError("進行状況を保存できませんでした。");
    else { setNotice("進行状況を保存しました。"); await loadOrders(); }
    setSaving(false);
  };

  const saveConcepts = async () => {
    if (!order || !conceptA.title || !conceptB.title) { setError("コンセプトA・Bのタイトルを入力してください。"); return; }
    setSaving(true);
    setError("");
    const rows = ([['A', conceptA], ['B', conceptB]] as const).map(([slot, value]) => ({
      order_id: order.id,
      slot,
      title: value.title,
      tone: value.tone,
      summary: value.summary,
      scenes: value.scenes.split("\n").map((scene) => scene.trim()).filter(Boolean),
      status: "published",
    }));
    const supabase = getSupabaseBrowserClient();
    const { error: conceptError } = await supabase.from("concepts").upsert(rows, { onConflict: "order_id,slot" });
    if (!conceptError) {
      const { error: orderError } = await supabase.from("orders").update({ status: "concepts_ready", stage_updated_at: new Date().toISOString() }).eq("id", order.id);
      if (orderError) setError("コンセプトは保存されましたが、公開状態を更新できませんでした。");
      else { setNotice("2つのコンセプトをお客様へ公開しました。"); await Promise.all([loadOrders(), loadConcepts(order.id)]); }
    } else setError("コンセプトを保存できませんでした。");
    setSaving(false);
  };

  const uploadFinalVideo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !order) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const path = `${order.user_id}/${order.id}/delivery/final-${crypto.randomUUID()}.${safeExtension(file)}`;
    const { error: uploadError } = await supabase.storage.from("order-assets").upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
    if (uploadError) { setError("映像をアップロードできませんでした。"); setSaving(false); return; }

    const { data: asset, error: assetError } = await supabase.from("assets").insert({
      order_id: order.id, user_id: order.user_id, category: "final_video", storage_path: path,
      original_filename: file.name, mime_type: file.type || "video/mp4", file_size: file.size,
    }).select("*").single();
    if (assetError) { await supabase.storage.from("order-assets").remove([path]); setError("映像情報を保存できませんでした。"); setSaving(false); return; }

    const finalAsset = asset as OrderAsset;
    const { error: deliveryError } = await supabase.from("deliveries").upsert({
      order_id: order.id, final_asset_id: finalAsset.id, title: deliveryTitle || `${order.pet_name}との映画`,
      customer_message: deliveryMessage || null, delivered_at: new Date().toISOString(),
    }, { onConflict: "order_id" });
    if (!deliveryError) {
      await supabase.from("orders").update({ status: "delivered", stage_updated_at: new Date().toISOString() }).eq("id", order.id);
      setNotice("完成映像と専用サイトをお客様へ納品しました。");
      await loadOrders();
    } else setError("映像は保存されましたが、納品情報を作成できませんでした。");
    setSaving(false);
    event.target.value = "";
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !order) return;
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") || "").trim();
    if (!body) return;
    const { error: messageError } = await getSupabaseBrowserClient().from("messages").insert({ order_id: order.id, sender_id: user.id, body });
    if (messageError) setError("メッセージを送信できませんでした。");
    else { event.currentTarget.reset(); setNotice("お客様へメッセージを送りました。"); }
  };

  if (authLoading || loading) return <div className="wizard-loading">運営画面を準備しています…</div>;
  if (!user || profile?.role !== "admin") return <main className="admin-denied"><p className="eyebrow">ADMIN ONLY</p><h1>管理者権限が必要です。</h1><p>管理者として登録されたアカウントでログインしてください。</p><Link className="button button-primary" href="/studio">制作室へ戻る</Link></main>;

  return (
    <main className="admin-page">
      <header className="admin-header"><Link className="brand" href="/"><span className="brand-mark">WM</span><span className="brand-type">WAN MEMORY<small>PRODUCTION ADMIN</small></span></Link><nav><Link href="/studio">顧客制作室</Link><span>{profile.full_name || profile.email}</span><button type="button" onClick={async () => { await signOut(); router.push("/"); }}>ログアウト</button></nav></header>
      <div className="admin-shell">
        <aside className="admin-sidebar"><p className="eyebrow">ORDERS</p><h1>制作管理</h1><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">すべての注文</option>{statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><div className="admin-order-list">{visibleOrders.map((item) => <button type="button" className={item.id === selectedOrderId ? "active" : ""} onClick={() => setSelectedOrderId(item.id)} key={item.id}><span>{ORDER_STATUS_LABELS[item.status]}</span><strong>{item.pet_name}</strong><small>{item.order_number} · ¥{new Intl.NumberFormat("ja-JP").format(item.quoted_price)}</small></button>)}</div></aside>
        <section className="admin-main">
          {notice && <p className="studio-alert">{notice}<button type="button" onClick={() => setNotice("")}>×</button></p>}
          {error && <p className="studio-alert error" role="alert">{error}</p>}
          {!order ? <div className="admin-empty"><h2>注文はまだありません。</h2><p>新しい相談が入るとこちらに表示されます。</p></div> : <>
            <div className="admin-title"><div><p className="eyebrow">{order.order_number}</p><h2>{order.pet_name}ちゃんのメモリーフィルム</h2><span>{customer?.full_name || customer?.email || order.user_id}</span></div><Link className="button button-outline" href={`/studio?order=${order.id}`}>顧客画面を確認</Link></div>

            <section className="admin-card"><div className="card-head"><div><p className="eyebrow">PRODUCTION STATUS</p><h3>進行状況・入金・納期</h3></div></div><div className="admin-form-grid"><label><span>現在の状態</span><select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>{statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>入金状態</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as MemoryOrder["payment_status"])}><option value="pending">ご案内前</option><option value="invoice_sent">お支払い待ち</option><option value="paid">入金確認済み</option><option value="refunded">返金済み</option></select></label><label><span>予定完成日</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label className="wide"><span>運営メモ（顧客には非表示）</span><textarea rows={3} value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} /></label></div><button className="button button-primary" type="button" disabled={saving} onClick={saveOrder}>進行状況を保存</button></section>

            <section className="admin-card"><div className="card-head"><div><p className="eyebrow">CUSTOMER STORY</p><h3>お預かりした内容</h3></div><span>{order.purpose}</span></div><dl className="admin-story"><div><dt>犬種・年齢</dt><dd>{order.breed} · {order.age_text || "未入力"}</dd></div><div><dt>性格</dt><dd>{order.personality.join("、") || "未入力"}</dd></div><div><dt>はじめて会った日</dt><dd>{order.first_meeting || "未入力"}</dd></div><div><dt>いちばんの思い出</dt><dd>{order.favorite_memory || "未入力"}</dd></div><div><dt>伝えたい言葉</dt><dd>{order.message_to_pet || "未入力"}</dd></div><div><dt>入れたくないこと</dt><dd>{order.avoid_notes || "なし"}</dd></div></dl></section>

            <section className="admin-card"><div className="card-head"><div><p className="eyebrow">CONCEPT DELIVERY</p><h3>映像コンセプト2案</h3></div><span>{concepts.length}/2 保存済み</span></div><div className="admin-concepts">{([['A', conceptA, setConceptA], ['B', conceptB, setConceptB]] as const).map(([slot, value, setter]) => <div key={slot}><strong>CONCEPT {slot}</strong><label><span>タイトル</span><input value={value.title} onChange={(event) => setter({ ...value, title: event.target.value })} placeholder={`${order.pet_name}と歩いた季節`} /></label><label><span>トーン</span><input value={value.tone} onChange={(event) => setter({ ...value, tone: event.target.value })} placeholder="やさしく、映画のように" /></label><label><span>概要</span><textarea rows={4} value={value.summary} onChange={(event) => setter({ ...value, summary: event.target.value })} /></label><label><span>シーン（1行に1つ）</span><textarea rows={5} value={value.scenes} onChange={(event) => setter({ ...value, scenes: event.target.value })} placeholder={"はじめて会った日\nいつもの散歩道\n家族を待つ時間"} /></label></div>)}</div><button className="button button-primary" type="button" disabled={saving} onClick={saveConcepts}>2案を顧客へ公開する →</button></section>

            <section className="admin-card"><div className="card-head"><div><p className="eyebrow">FINAL DELIVERY</p><h3>完成映像を納品</h3></div><span>MP4 / MOV / WebM</span></div><div className="admin-form-grid"><label><span>映画タイトル</span><input value={deliveryTitle} onChange={(event) => setDeliveryTitle(event.target.value)} /></label><label className="wide"><span>お客様へのメッセージ</span><textarea rows={3} value={deliveryMessage} onChange={(event) => setDeliveryMessage(event.target.value)} /></label></div><label className={saving ? "admin-video-upload disabled" : "admin-video-upload"}><input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={saving} onChange={uploadFinalVideo} /><strong>完成映像を選んで納品する</strong><small>アップロード完了後、顧客の制作室と専用サイトへ表示されます。</small></label></section>

            <section className="admin-card"><div className="card-head"><div><p className="eyebrow">MESSAGE</p><h3>お客様へ連絡</h3></div></div><form className="admin-message-form" onSubmit={sendMessage}><textarea name="body" rows={4} placeholder="追加写真のお願い、確認事項、進行状況など" /><button className="button button-outline" type="submit">メッセージを送る</button></form></section>
          </>}
        </section>
      </div>
    </main>
  );
}
