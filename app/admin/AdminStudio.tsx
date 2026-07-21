"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { hasCurrentConsent } from "../lib/consent";
import type { FilmConcept, MemoryOrder, OrderAsset, OrderMessage, Profile, RevisionRequest } from "../lib/supabase/types";
import { ORDER_STATUS_LABELS, type OrderStatus } from "../lib/supabase/types";

type ConceptDraft = { title: string; tone: string; summary: string; scenes: string };
type VideoMode = "review" | "final";
type AttentionCount = { messages: number; revisions: number };

const emptyConcept: ConceptDraft = { title: "", tone: "", summary: "", scenes: "" };
const statusOptions = Object.entries(ORDER_STATUS_LABELS) as Array<[OrderStatus, string]>;
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  awaiting_materials: ["awaiting_materials", "cancelled"],
  materials_submitted: ["materials_submitted", "reviewing_materials", "cancelled"],
  reviewing_materials: ["reviewing_materials", "cancelled"],
  concepts_ready: ["concepts_ready", "reviewing_materials", "cancelled"],
  concept_selected: ["concept_selected", "concepts_ready", "production", "cancelled"],
  production: ["production", "concept_selected", "cancelled"],
  customer_review: ["customer_review", "production", "cancelled"],
  revision_requested: ["revision_requested", "production", "cancelled"],
  quality_check: ["quality_check", "production", "customer_review", "cancelled"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

function safeExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function formatDateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

function peopleHandlingLabel(value: MemoryOrder["people_handling"]) {
  const labels: Record<Exclude<MemoryOrder["people_handling"], null>, string> = {
    not_applicable: "該当なし",
    dog_only_crop: "愛犬だけを切り抜いて使用",
    anonymous_person: "顔が分からない後ろ姿・手元・足元・シルエットで表現",
    original_still: "元の家族写真をAIで動かさず使用",
    consult: "担当者へ相談",
  };
  return value ? labels[value] : "未確認";
}

export function AdminStudio() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState<MemoryOrder[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [concepts, setConcepts] = useState<FilmConcept[]>([]);
  const [assets, setAssets] = useState<OrderAsset[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [conceptA, setConceptA] = useState<ConceptDraft>(emptyConcept);
  const [conceptB, setConceptB] = useState<ConceptDraft>(emptyConcept);
  const [status, setStatus] = useState<OrderStatus>("materials_submitted");
  const [paymentStatus, setPaymentStatus] = useState<MemoryOrder["payment_status"]>("pending");
  const [dueDate, setDueDate] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [deliveryTitle, setDeliveryTitle] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [videoMode, setVideoMode] = useState<VideoMode>("review");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoChecked, setVideoChecked] = useState(false);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [attentionByOrder, setAttentionByOrder] = useState<Record<string, AttentionCount>>({});

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/admin");
  }, [authLoading, router, user]);

  const loadOrders = useCallback(async () => {
    if (!user || profile?.role !== "admin") return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const [ordersResult, profilesResult, messageResult, revisionResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,email,full_name,primary_pet_name,role"),
      supabase.from("messages").select("order_id").eq("status", "open"),
      supabase.from("revision_requests").select("order_id").eq("status", "open"),
    ]);
    if (ordersResult.error) setError("注文一覧を読み込めませんでした。");
    const loaded = (ordersResult.data ?? []) as MemoryOrder[];
    setOrders(loaded);
    setCustomers((profilesResult.data ?? []) as Profile[]);
    const attention: Record<string, AttentionCount> = {};
    const ensure = (orderId: string) => attention[orderId] ??= { messages: 0, revisions: 0 };
    for (const item of messageResult.data ?? []) ensure(item.order_id).messages += 1;
    for (const item of revisionResult.data ?? []) ensure(item.order_id).revisions += 1;
    setAttentionByOrder(attention);
    setSelectedOrderId((current) => current || loaded[0]?.id || "");
    setLoading(false);
  }, [profile?.role, user]);

  const loadDetails = useCallback(async (orderId: string) => {
    if (!orderId) return;
    const supabase = getSupabaseBrowserClient();
    const [conceptResult, assetResult, messageResult, revisionResult] = await Promise.all([
      supabase.from("concepts").select("*").eq("order_id", orderId).order("slot"),
      supabase.from("assets").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("revision_requests").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    ]);
    const loadedConcepts = (conceptResult.data ?? []) as FilmConcept[];
    const loadedAssets = (assetResult.data ?? []) as OrderAsset[];
    setConcepts(loadedConcepts);
    setAssets(loadedAssets);
    setMessages((messageResult.data ?? []) as OrderMessage[]);
    setRevisions((revisionResult.data ?? []) as RevisionRequest[]);
    const toDraft = (concept?: FilmConcept): ConceptDraft => concept
      ? { title: concept.title, tone: concept.tone, summary: concept.summary, scenes: concept.scenes.join("\n") }
      : emptyConcept;
    setConceptA(toDraft(loadedConcepts.find((concept) => concept.slot === "A")));
    setConceptB(toDraft(loadedConcepts.find((concept) => concept.slot === "B")));

    const signable = loadedAssets.filter((asset) => asset.category === "source_image" || asset.category === "review_video" || asset.category === "final_video");
    const signed = await Promise.all(signable.map(async (asset) => {
      const { data } = await supabase.storage.from("order-assets").createSignedUrl(asset.storage_path, 3600);
      return [asset.id, data?.signedUrl ?? ""] as const;
    }));
    setAssetUrls(Object.fromEntries(signed));
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
  const sourceAssets = useMemo(() => assets.filter((asset) => asset.category === "source_image"), [assets]);
  const reviewVideos = useMemo(() => assets.filter((asset) => asset.category === "review_video"), [assets]);
  const finalVideos = useMemo(() => assets.filter((asset) => asset.category === "final_video"), [assets]);
  const openMessages = useMemo(() => messages.filter((message) => message.sender_id === order?.user_id && message.status === "open"), [messages, order?.user_id]);
  const openRevisions = useMemo(() => revisions.filter((revision) => revision.status === "open"), [revisions]);
  const selectableStatuses = order ? statusOptions.filter(([value]) => {
    if (!allowedTransitions[order.status].includes(value)) return false;
    if (value !== order.status && ["production", "customer_review", "revision_requested", "quality_check"].includes(value) && order.payment_status !== "paid") return false;
    return true;
  }) : statusOptions;
  const consentCurrent = Boolean(order && hasCurrentConsent(order));
  const canUploadReview = Boolean(order && order.payment_status === "paid" && consentCurrent && ["production", "revision_requested", "customer_review"].includes(order.status));
  const canUploadFinal = Boolean(order && order.status === "quality_check" && order.payment_status === "paid" && consentCurrent && order.customer_approved_at && order.customer_approved_review_asset_id && openRevisions.length === 0);

  useEffect(() => {
    if (!order) return;
    const timer = window.setTimeout(() => {
      setStatus(order.status);
      setPaymentStatus(order.payment_status);
      setDueDate(order.due_date ?? "");
      setAdminNotes(order.admin_notes ?? "");
      setDeliveryTitle(`${order.pet_name}との映画`);
      setDeliveryMessage(`${order.pet_name}ちゃんとの大切な時間を、一本の映画に仕上げました。`);
      setVideoMode("review");
      setVideoFile(null);
      setVideoChecked(false);
      setVideoInputKey((current) => current + 1);
      loadDetails(order.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetails, order]);

  const hasAttention = (orderId: string) => {
    const count = attentionByOrder[orderId];
    return Boolean(count && count.messages + count.revisions > 0);
  };
  const visibleOrders = filter === "all" ? orders : filter === "attention" ? orders.filter((item) => hasAttention(item.id)) : orders.filter((item) => item.status === filter);
  const totalAttention = Object.values(attentionByOrder).reduce((total, count) => total + count.messages + count.revisions, 0);

  const changeFilter = (nextFilter: string) => {
    setFilter(nextFilter);
    const nextOrders = nextFilter === "all" ? orders : nextFilter === "attention" ? orders.filter((item) => hasAttention(item.id)) : orders.filter((item) => item.status === nextFilter);
    if (nextOrders.length && !nextOrders.some((item) => item.id === selectedOrderId)) setSelectedOrderId(nextOrders[0].id);
    if (!nextOrders.length) setSelectedOrderId("");
  };

  const saveOrder = async () => {
    if (!order) return;
    setSaving(true);
    setError("");
    const { error: updateError } = await getSupabaseBrowserClient().rpc("admin_update_order", {
      p_order_id: order.id,
      p_status: status,
      p_payment_status: paymentStatus,
      p_due_date: dueDate || null,
      p_admin_notes: adminNotes || null,
    });
    if (updateError) setError(`進行状況を保存できませんでした。${updateError.message.includes("invalid order status transition") ? "許可されていない工程への移動です。" : ""}`);
    else { setNotice("進行状況を保存し、履歴へ記録しました。"); await loadOrders(); }
    setSaving(false);
  };

  const saveConcepts = async () => {
    if (!order || !conceptA.title.trim() || !conceptA.summary.trim() || !conceptB.title.trim() || !conceptB.summary.trim()) {
      setError("コンセプトA・Bのタイトルと概要を入力してください。");
      return;
    }
    setSaving(true);
    setError("");
    const conceptsPayload = ([['A', conceptA], ['B', conceptB]] as const).map(([slot, value]) => ({
      slot,
      title: value.title.trim(),
      tone: value.tone.trim(),
      summary: value.summary.trim(),
      scenes: value.scenes.split("\n").map((scene) => scene.trim()).filter(Boolean),
    }));
    const { error: conceptError } = await getSupabaseBrowserClient().rpc("admin_publish_concepts", { p_order_id: order.id, p_concepts: conceptsPayload });
    if (conceptError) setError("2案を公開できませんでした。先に進行状況を『写真とお話を確認しています』へ変更してください。");
    else {
      setNotice("2つのコンセプトを公開し、操作履歴へ記録しました。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const selectVideo = (event: ChangeEvent<HTMLInputElement>) => {
    setVideoFile(event.target.files?.[0] ?? null);
    setVideoChecked(false);
    setError("");
  };

  const clearVideo = () => {
    setVideoFile(null);
    setVideoChecked(false);
    setVideoInputKey((current) => current + 1);
  };

  const uploadVideo = async () => {
    if (!videoFile || !order || !videoChecked) return;
    if ((videoMode === "review" && !canUploadReview) || (videoMode === "final" && !canUploadFinal)) {
      setError(videoMode === "review" ? "確認映像は、映像制作または修正対応の工程で公開できます。" : "最終納品の前に、進行状況を『最終確認をしています』へ変更してください。");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const category = videoMode === "review" ? "review_video" : "final_video";
    const folder = videoMode === "review" ? "review" : "delivery";
    const path = `${order.user_id}/${order.id}/${folder}/${category}-${crypto.randomUUID()}.${safeExtension(videoFile)}`;
    const mimeType = videoFile.type || "video/mp4";
    const { error: uploadError } = await supabase.storage.from("order-assets").upload(path, videoFile, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setError("映像をアップロードできませんでした。");
      setSaving(false);
      return;
    }

    const { data: assetId, error: assetError } = await supabase.rpc("admin_register_video_asset", {
      p_order_id: order.id,
      p_category: category,
      p_storage_path: path,
      p_original_filename: videoFile.name,
      p_mime_type: mimeType,
      p_file_size: videoFile.size,
    });
    if (assetError || !assetId) {
      await supabase.storage.from("order-assets").remove([path]);
      setError("映像情報を登録できませんでした。現在の制作工程をご確認ください。");
      setSaving(false);
      return;
    }

    if (videoMode === "final") {
      const { error: deliveryError } = await supabase.rpc("admin_deliver_order", {
        p_order_id: order.id,
        p_asset_id: assetId,
        p_title: deliveryTitle.trim() || `${order.pet_name}との映画`,
        p_customer_message: deliveryMessage.trim() || null,
      });
      if (deliveryError) {
        clearVideo();
        await loadDetails(order.id);
        setError("映像は登録済みですが、納品処理だけ完了できませんでした。下の「登録済み映像で納品を再試行」から再利用できます。");
        setSaving(false);
        return;
      }
      setNotice("完成映像と専用サイトをお客様へ納品しました。");
    } else {
      setNotice("完成前の確認映像を公開しました。注文は納品済みになっていません。");
    }
    clearVideo();
    await Promise.all([loadOrders(), loadDetails(order.id)]);
    setSaving(false);
  };

  const retryDelivery = async (asset: OrderAsset) => {
    if (!order || !canUploadFinal) return;
    if (!window.confirm(`${order.pet_name}ちゃんへ「${asset.original_filename}」を最終納品しますか？`)) return;
    setSaving(true);
    setError("");
    const { error: deliveryError } = await getSupabaseBrowserClient().rpc("admin_deliver_order", {
      p_order_id: order.id,
      p_asset_id: asset.id,
      p_title: deliveryTitle.trim() || `${order.pet_name}との映画`,
      p_customer_message: deliveryMessage.trim() || null,
    });
    if (deliveryError) setError("登録済み映像での納品を完了できませんでした。入金・顧客承認・未対応修正をご確認ください。");
    else {
      setNotice("登録済みの完成映像を使って納品を完了しました。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const resolveMessage = async (messageId: string) => {
    if (!order) return;
    setSaving(true);
    const { error: resolveError } = await getSupabaseBrowserClient().rpc("admin_resolve_message", { p_message_id: messageId });
    if (resolveError) setError("メッセージを対応済みにできませんでした。");
    else { setNotice("メッセージを対応済みにしました。"); await Promise.all([loadOrders(), loadDetails(order.id)]); }
    setSaving(false);
  };

  const resolveRevision = async (revisionId: string) => {
    if (!order) return;
    setSaving(true);
    const { error: resolveError } = await getSupabaseBrowserClient().rpc("admin_resolve_revision", { p_revision_id: revisionId });
    if (resolveError) setError(resolveError.message.includes("revised review video") ? "先に修正版を『完成前の確認映像』として公開してください。" : "修正依頼を対応済みにできませんでした。");
    else { setNotice("修正依頼を対応済みにし、履歴へ記録しました。"); await Promise.all([loadOrders(), loadDetails(order.id)]); }
    setSaving(false);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order) return;
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") || "").trim();
    if (!body) return;
    const { error: messageError } = await getSupabaseBrowserClient().rpc("admin_send_message", { p_order_id: order.id, p_body: body });
    if (messageError) setError("メッセージを送信できませんでした。");
    else {
      event.currentTarget.reset();
      setNotice("お客様へメッセージを送りました。");
      await loadDetails(order.id);
    }
  };

  if (authLoading || loading) return <div className="wizard-loading">運営画面を準備しています…</div>;
  if (!user || profile?.role !== "admin") return <main className="admin-denied"><p className="eyebrow">ADMIN ONLY</p><h1>管理者権限が必要です。</h1><p>管理者として登録されたアカウントでログインしてください。</p><Link className="button button-primary" href="/studio">制作室へ戻る</Link></main>;

  return (
    <main className="admin-page">
      <header className="admin-header"><Link className="brand" href="/"><span className="brand-mark">WM</span><span className="brand-type">WAN MEMORY<small>PRODUCTION ADMIN</small></span></Link><nav><Link href="/studio">顧客制作室</Link><span>{profile.full_name || profile.email}</span><button type="button" onClick={async () => { await signOut(); router.push("/"); }}>ログアウト</button></nav></header>
      <div className="admin-shell">
        <aside className="admin-sidebar"><p className="eyebrow">ORDERS</p><h1>制作管理</h1>{totalAttention > 0 && <button type="button" className="admin-sidebar-total" onClick={() => changeFilter("attention")}><strong>{totalAttention}件</strong><span>対応が必要な連絡・修正</span></button>}<select aria-label="注文の状態で絞り込む" value={filter} onChange={(event) => changeFilter(event.target.value)}><option value="all">すべての注文</option><option value="attention">未対応あり（{totalAttention}件）</option>{statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><label className="admin-mobile-order-picker"><span>対応する注文</span><select value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>{visibleOrders.map((item) => { const attention = attentionByOrder[item.id]; const count = (attention?.messages ?? 0) + (attention?.revisions ?? 0); return <option value={item.id} key={item.id}>{count ? `● ${count}件 · ` : ""}{item.pet_name} · {ORDER_STATUS_LABELS[item.status]}</option>; })}</select></label><div className="admin-order-list">{visibleOrders.map((item) => { const attention = attentionByOrder[item.id]; const count = (attention?.messages ?? 0) + (attention?.revisions ?? 0); return <button type="button" className={item.id === selectedOrderId ? "active" : ""} onClick={() => setSelectedOrderId(item.id)} key={item.id}><span>{ORDER_STATUS_LABELS[item.status]}{count > 0 && <b className="admin-order-alert">未対応 {count}</b>}</span><strong>{item.pet_name}</strong><small>{item.order_number} · ¥{new Intl.NumberFormat("ja-JP").format(item.quoted_price)}</small></button>; })}</div></aside>
        <section className="admin-main">
          {notice && <p className="studio-alert" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></p>}
          {error && <p className="studio-alert error" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></p>}
          {!order ? <div className="admin-empty"><h2>注文はまだありません。</h2><p>新しい相談が入るとこちらに表示されます。</p></div> : <>
            <div className="admin-title"><div><p className="eyebrow">{order.order_number}</p><h2>{order.pet_name}ちゃんのメモリーフィルム</h2><span>{customer?.full_name || customer?.email || order.user_id}</span></div><Link className="button button-outline" href={`/studio?order=${order.id}&preview=1`} target="_blank" rel="noreferrer">顧客画面を閲覧</Link></div>

            <aside className="admin-attention-summary" aria-label="未対応項目"><div><strong>{sourceAssets.length}</strong><span>お預かり写真</span></div><div className={openMessages.length ? "needs-action" : ""}><strong>{openMessages.length}</strong><span>未対応メッセージ</span></div><div className={openRevisions.length ? "needs-action" : ""}><strong>{openRevisions.length}</strong><span>未対応の修正</span></div><div><strong>{order.revision_used}/{order.revision_limit}</strong><span>使用済み修正回数</span></div></aside>

            <nav className="admin-mobile-sections" aria-label="管理項目"><a href="#admin-progress">進行</a><a href="#admin-story">内容</a><a href="#admin-photos">写真</a><a href="#admin-concepts">2案</a><a href="#admin-revisions">修正</a><a href="#admin-video">映像</a><a href="#admin-message">連絡</a></nav>

            <section className="admin-card" id="admin-progress"><div className="card-head"><div><p className="eyebrow">PRODUCTION STATUS</p><h3>進行状況・入金・納期</h3></div><span>許可された次の工程だけを表示</span></div>{order.payment_status !== "paid" && !["delivered", "cancelled"].includes(order.status) && <aside className="admin-operation-note warning"><strong>入金確認前です。</strong><span>「入金確認済み」を一度保存するまで、映像制作・確認映像公開・納品には進めません。</span></aside>}{!consentCurrent && !["delivered", "cancelled"].includes(order.status) && <aside className="admin-operation-note warning"><strong>写真・人物の取り扱いに必要な同意記録が揃っていません。</strong><span>お客様が制作室で人物・未成年者の有無、写真使用権限、写っている人物の同意、外部制作サービスでの処理を確認するまで制作を開始できません。</span></aside>}{order.customer_approved_at && <aside className="admin-operation-note strong"><strong>お客様が確認映像を確定済みです。</strong><span>{formatDateTime(order.customer_approved_at)} · 承認した確認映像ID {order.customer_approved_review_asset_id}</span></aside>}<div className="admin-form-grid"><label><span>現在の状態</span><select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>{selectableStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>入金状態</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as MemoryOrder["payment_status"])}><option value="pending">ご案内前</option><option value="invoice_sent">お支払い待ち</option><option value="paid">入金確認済み</option><option value="refunded">返金済み</option></select></label><label><span>予定完成日</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label className="wide"><span>運営メモ（顧客には非表示）</span><textarea rows={3} value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} /></label></div><button className="button button-primary" type="button" disabled={saving} onClick={saveOrder}>進行状況を保存</button></section>

            <section className="admin-card" id="admin-story"><div className="card-head"><div><p className="eyebrow">CUSTOMER STORY</p><h3>お預かりした内容</h3></div><span>{order.purpose}</span></div><dl className="admin-story"><div><dt>犬種・年齢</dt><dd>{order.breed} · {order.age_text || "未入力"}</dd></div><div><dt>性格</dt><dd>{order.personality.join("、") || "未入力"}</dd></div><div><dt>はじめて会った日</dt><dd>{order.first_meeting || "未入力"}</dd></div><div><dt>いちばんの思い出</dt><dd>{order.favorite_memory || "未入力"}</dd></div><div><dt>伝えたい言葉</dt><dd>{order.message_to_pet || "未入力"}</dd></div><div><dt>入れたくないこと</dt><dd>{order.avoid_notes || "なし"}</dd></div><div><dt>人物の有無</dt><dd>{order.contains_people === true ? "あり" : order.contains_people === false ? "なし" : "未確認（制作不可）"}</dd></div><div><dt>人物の取り扱い</dt><dd>{peopleHandlingLabel(order.people_handling)}</dd></div><div><dt>未成年者</dt><dd>{order.contains_minors === true ? "あり" : order.contains_minors === false ? "なし" : "未確認（制作不可）"}</dd></div><div><dt>規約・Privacy同意</dt><dd>{order.consented_at ? `${formatDateTime(order.consented_at)} · 規約 ${order.terms_version} / Privacy ${order.privacy_version}` : "同意記録なし"}</dd></div><div><dt>写真使用権限</dt><dd>{order.photo_rights_consented_at ? `${formatDateTime(order.photo_rights_consented_at)} · ${order.photo_rights_consent_version}` : "同意記録なし"}</dd></div><div><dt>写っている人物の同意</dt><dd>{order.contains_people === false ? "対象外" : order.depicted_people_consented_at ? `${formatDateTime(order.depicted_people_consented_at)} · ${order.depicted_people_consent_version}` : "同意記録なし"}</dd></div><div><dt>未成年者の保護者同意</dt><dd>{order.contains_minors === false ? "対象外" : order.minor_guardian_consented_at ? `${formatDateTime(order.minor_guardian_consented_at)} · ${order.minor_guardian_consent_version}` : "同意記録なし"}</dd></div><div><dt>外部AI処理同意</dt><dd>{order.external_ai_consent_at ? `${formatDateTime(order.external_ai_consent_at)} · Notice ${order.ai_notice_version}` : "同意記録なし"}</dd></div></dl></section>

            <section className="admin-card" id="admin-photos"><div className="card-head"><div><p className="eyebrow">CUSTOMER PHOTOS</p><h3>お預かりした写真</h3></div><span>{sourceAssets.length}枚</span></div>{sourceAssets.length ? <div className="admin-photo-grid">{sourceAssets.map((asset) => <a href={assetUrls[asset.id]} target="_blank" rel="noreferrer" aria-label={`${asset.original_filename}を大きく表示`} key={asset.id}>{assetUrls[asset.id] ? <span className="admin-photo-thumb" role="img" aria-label={`${order.pet_name}ちゃんの提出写真`} style={{ backgroundImage: `url(${assetUrls[asset.id]})` }} /> : <span>読み込み中</span>}<small>{asset.original_filename}</small></a>)}</div> : <p className="admin-empty-copy">写真はまだ登録されていません。最低5枚の提出が完了するまで注文は受付済みになりません。</p>}</section>

            <section className="admin-card" id="admin-concepts"><div className="card-head"><div><p className="eyebrow">CONCEPT DELIVERY</p><h3>映像コンセプト2案</h3></div><span>{concepts.length}/2 保存済み</span></div><div className="admin-concepts">{([['A', conceptA, setConceptA], ['B', conceptB, setConceptB]] as const).map(([slot, value, setter]) => <div key={slot}><strong>CONCEPT {slot}</strong><label><span>タイトル</span><input value={value.title} onChange={(event) => setter({ ...value, title: event.target.value })} placeholder={`${order.pet_name}と歩いた季節`} /></label><label><span>トーン</span><input value={value.tone} onChange={(event) => setter({ ...value, tone: event.target.value })} placeholder="やさしく、映画のように" /></label><label><span>概要</span><textarea rows={4} value={value.summary} onChange={(event) => setter({ ...value, summary: event.target.value })} /></label><label><span>シーン（1行に1つ）</span><textarea rows={5} value={value.scenes} onChange={(event) => setter({ ...value, scenes: event.target.value })} placeholder={"はじめて会った日\nいつもの散歩道\n家族を待つ時間"} /></label></div>)}</div><button className="button button-primary" type="button" disabled={saving} onClick={saveConcepts}>2案を顧客へ公開する →</button></section>

            <section className="admin-card" id="admin-revisions"><div className="card-head"><div><p className="eyebrow">REVISION REQUESTS</p><h3>修正依頼</h3></div><span>{order.revision_used}/{order.revision_limit}回使用</span></div>{revisions.length ? <div className="admin-work-list">{revisions.map((revision) => <article key={revision.id}><div><span className={revision.status === "open" ? "work-status open" : "work-status"}>{revision.status === "open" ? "対応が必要" : "対応済み"}</span><small>{formatDate(revision.created_at)}</small></div><strong>{revision.category}</strong><p>{revision.body}</p>{revision.status === "open" && <button className="button button-outline" type="button" disabled={saving} onClick={() => resolveRevision(revision.id)}>対応完了にする</button>}</article>)}</div> : <p className="admin-empty-copy">修正依頼はまだありません。</p>}<p className="admin-operation-note">修正版を「完成前の確認映像」として公開してから、該当依頼を対応完了にしてください。上限はDBでも{order.revision_limit}回に制限されています。</p></section>

            <section className="admin-card" id="admin-video"><div className="card-head"><div><p className="eyebrow">VIDEO WORKFLOW</p><h3>{videoMode === "review" ? "完成前の確認映像" : "完成映像の最終納品"}</h3></div><span>MP4 / MOV / WebM</span></div><div className="admin-video-tabs"><button type="button" className={videoMode === "review" ? "active" : ""} onClick={() => { setVideoMode("review"); clearVideo(); }}>1. 顧客確認用</button><button type="button" className={videoMode === "final" ? "active" : ""} onClick={() => { setVideoMode("final"); clearVideo(); }}>2. 最終納品</button></div>{videoMode === "review" ? <><aside className="admin-operation-note strong"><strong>このアップロードでは納品済みになりません。</strong><span>お客様の制作室に確認映像を表示し、状態を「完成前の映像をご確認ください」へ進めます。</span></aside>{!canUploadReview && <aside className="admin-operation-note warning"><strong>確認映像を公開できません。</strong><span>{order.payment_status !== "paid" ? "先に入金確認を保存してください。" : !consentCurrent ? "お客様による現在版の同意記録が必要です。" : "コンセプト選択後、進行状況を「約1分の映画を制作しています」へ進めてください。"}</span></aside>}</> : <><div className="admin-form-grid"><label><span>映画タイトル</span><input value={deliveryTitle} onChange={(event) => setDeliveryTitle(event.target.value)} /></label><label className="wide"><span>お客様へのメッセージ</span><textarea rows={3} value={deliveryMessage} onChange={(event) => setDeliveryMessage(event.target.value)} /></label></div>{!canUploadFinal && <aside className="admin-operation-note warning"><strong>まだ最終納品できません。</strong><span>{order.payment_status !== "paid" ? "入金確認が必要です。" : !consentCurrent ? "現在版の同意記録が必要です。" : openRevisions.length ? "未対応の修正依頼をすべて解決してください。" : !order.customer_approved_at ? "お客様が確認映像の「この映像で確定する」を押すまでお待ちください。" : "お客様が承認した映像と制作工程を確認してください。"}</span></aside>}</>}<label className={saving || (videoMode === "review" ? !canUploadReview : !canUploadFinal) ? "admin-video-upload disabled" : "admin-video-upload"}><input key={videoInputKey} type="file" accept="video/mp4,video/quicktime,video/webm" disabled={saving || (videoMode === "review" ? !canUploadReview : !canUploadFinal)} onChange={selectVideo} /><strong>{videoFile ? "別の映像を選ぶ" : videoMode === "review" ? "確認映像を選ぶ" : "完成映像を選ぶ"}</strong><small>選択しただけでは公開・納品されません。次の確認欄で確定します。</small></label>{videoFile && <div className="admin-delivery-review" role="group" aria-label="映像アップロードの最終確認"><p className="eyebrow">UPLOAD CHECK</p><h4>{videoMode === "review" ? "まだ顧客へ公開されていません" : "まだ納品されていません"}</h4><dl><div><dt>お客様</dt><dd>{order.pet_name}ちゃん · {customer?.full_name || customer?.email || "登録ユーザー"}</dd></div><div><dt>ファイル</dt><dd>{videoFile.name}</dd></div><div><dt>サイズ</dt><dd>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</dd></div><div><dt>用途</dt><dd>{videoMode === "review" ? "完成前の顧客確認" : "最終納品"}</dd></div></dl><label className="admin-delivery-check"><input type="checkbox" checked={videoChecked} onChange={(event) => setVideoChecked(event.target.checked)} /><span>お客様名・ファイル名・用途を確認しました</span></label><div><button className="button button-outline" type="button" disabled={saving} onClick={clearVideo}>選び直す</button><button className="button button-primary" type="button" disabled={saving || !videoChecked || (videoMode === "review" ? !canUploadReview : !canUploadFinal)} onClick={uploadVideo}>{saving ? "アップロード中…" : videoMode === "review" ? "確認映像として公開する →" : "確認した内容で納品する →"}</button></div></div>}{reviewVideos.length > 0 && <div className="admin-video-history"><strong>公開済みの確認映像</strong>{reviewVideos.map((asset) => <a href={assetUrls[asset.id]} target="_blank" rel="noreferrer" key={asset.id}>{asset.original_filename}<small>{formatDate(asset.created_at)}</small></a>)}</div>}{videoMode === "final" && finalVideos.length > 0 && <div className="admin-video-history"><strong>登録済みの完成映像</strong>{finalVideos.map((asset) => <div className="admin-video-retry" key={asset.id}><a href={assetUrls[asset.id]} target="_blank" rel="noreferrer">{asset.original_filename}<small>{formatDate(asset.created_at)}</small></a><button className="button button-outline" type="button" disabled={saving || !canUploadFinal} onClick={() => retryDelivery(asset)}>この映像で納品を再試行</button></div>)}</div>}</section>

            <section className="admin-card" id="admin-message"><div className="card-head"><div><p className="eyebrow">MESSAGES</p><h3>お客様との連絡</h3></div><span>{openMessages.length}件 未対応</span></div><div className="admin-work-list admin-message-list">{messages.length ? messages.map((message) => { const fromCustomer = message.sender_id === order.user_id; return <article className={fromCustomer ? "customer" : "admin"} key={message.id}><div><span className={fromCustomer && message.status === "open" ? "work-status open" : "work-status"}>{fromCustomer ? message.status === "open" ? "未対応" : "対応済み" : "運営から送信"}</span><small>{formatDate(message.created_at)}</small></div><p>{message.body}</p>{fromCustomer && message.status === "open" && <button className="button button-outline" type="button" disabled={saving} onClick={() => resolveMessage(message.id)}>対応済みにする</button>}</article>; }) : <p className="admin-empty-copy">メッセージはまだありません。</p>}</div><form className="admin-message-form" onSubmit={sendMessage}><textarea name="body" rows={4} maxLength={3000} placeholder="追加写真のお願い、確認事項、進行状況など" /><button className="button button-outline" type="submit">メッセージを送る</button></form></section>
          </>}
        </section>
      </div>
    </main>
  );
}
