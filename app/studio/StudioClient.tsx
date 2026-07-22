"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { CONSENT_VERSIONS, hasCurrentConsent } from "../lib/consent";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type { Delivery, FilmConcept, MemoryOrder, OrderAsset, OrderMemory, OrderMessage, PeopleHandling, RevisionRequest } from "../lib/supabase/types";
import { ORDER_STATUS_LABELS } from "../lib/supabase/types";
import { uploadOrderImages } from "../lib/supabase/uploads";
import { MemoryShareManager } from "./MemoryShareManager";

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

function formatDateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export function StudioClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState<MemoryOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [assets, setAssets] = useState<OrderAsset[]>([]);
  const [memories, setMemories] = useState<OrderMemory[]>([]);
  const [concepts, setConcepts] = useState<FilmConcept[]>([]);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [reviewVideoUrl, setReviewVideoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingConceptSlot, setPendingConceptSlot] = useState<"A" | "B" | null>(null);
  const [confirmingConcept, setConfirmingConcept] = useState(false);
  const [conceptReceipt, setConceptReceipt] = useState<{ slot: "A" | "B"; title: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [messageBody, setMessageBody] = useState("");
  const [revisionCategory, setRevisionCategory] = useState("映像の動き");
  const [revisionBody, setRevisionBody] = useState("");
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [approvingReview, setApprovingReview] = useState(false);
  const [acceptingConsent, setAcceptingConsent] = useState(false);
  const [consentTermsChecked, setConsentTermsChecked] = useState(false);
  const [consentPhotoRightsChecked, setConsentPhotoRightsChecked] = useState(false);
  const [consentPeopleChecked, setConsentPeopleChecked] = useState(false);
  const [consentGuardianChecked, setConsentGuardianChecked] = useState(false);
  const [consentAiChecked, setConsentAiChecked] = useState(false);
  const [renewContainsPeople, setRenewContainsPeople] = useState<"" | "none" | "included">("");
  const [renewPeopleHandling, setRenewPeopleHandling] = useState<PeopleHandling | "">("");
  const [renewContainsMinors, setRenewContainsMinors] = useState<"" | "none" | "included">("");
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
    const [assetResult, memoryResult, conceptResult, deliveryResult, messageResult, revisionResult] = await Promise.all([
      supabase.from("assets").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("order_memories").select("*").eq("order_id", orderId).order("sort_order"),
      supabase.from("concepts").select("*").eq("order_id", orderId).eq("status", "published").order("slot"),
      supabase.from("deliveries").select("*").eq("order_id", orderId).maybeSingle(),
      supabase.from("messages").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("revision_requests").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    ]);
    setAssets((assetResult.data ?? []) as OrderAsset[]);
    setMemories((memoryResult.data ?? []) as OrderMemory[]);
    setConcepts((conceptResult.data ?? []) as FilmConcept[]);
    setDelivery((deliveryResult.data as Delivery | null) ?? null);
    setMessages((messageResult.data ?? []) as OrderMessage[]);
    setRevisions((revisionResult.data ?? []) as RevisionRequest[]);
    setVideoUrl("");
    setReviewVideoUrl("");
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
  const reviewAsset = useMemo(() => assets.filter((asset) => asset.category === "review_video").at(-1) ?? null, [assets]);

  useEffect(() => {
    if (!finalAsset) return;
    getSupabaseBrowserClient().storage.from("order-assets").createSignedUrl(finalAsset.storage_path, 3600).then(({ data }) => setVideoUrl(data?.signedUrl ?? ""));
  }, [finalAsset]);

  useEffect(() => {
    if (!reviewAsset) return;
    getSupabaseBrowserClient().storage.from("order-assets").createSignedUrl(reviewAsset.storage_path, 3600).then(({ data }) => setReviewVideoUrl(data?.signedUrl ?? ""));
  }, [reviewAsset]);

  const currentStep = order ? statusStep[order.status] : 0;
  const isOrderOwner = Boolean(order && user && order.user_id === user.id);
  const readOnlyPreview = Boolean(order && profile?.role === "admin" && (searchParams.get("preview") === "1" || !isOrderOwner));
  const canOperateOrder = isOrderOwner && !readOnlyPreview;
  const consentCurrent = order ? hasCurrentConsent(order) : false;
  const effectiveConceptSlot = pendingConceptSlot ?? order?.selected_concept_slot ?? null;
  const pendingConcept = effectiveConceptSlot ? concepts.find((concept) => concept.slot === effectiveConceptSlot) ?? null : null;
  const canEditConcept = canOperateOrder && (order?.status === "concepts_ready" || order?.status === "concept_selected");
  const sourceAssets = assets.filter((asset) => asset.category === "source_image");
  const canAddPhotos = canOperateOrder && order?.status !== "cancelled";
  const revisionsRemaining = order ? Math.max(order.revision_limit - order.revision_used, 0) : 0;
  const hasOpenRevisions = revisions.some((revision) => revision.status === "open");
  const hasPendingConceptChange = Boolean(canEditConcept && pendingConcept && effectiveConceptSlot !== order?.selected_concept_slot);
  const nextAction = useMemo(() => {
    if (!order) return null;
    switch (order.status) {
      case "awaiting_materials":
      case "materials_submitted":
        return { title: "写真とお預かり内容を確認", copy: "追加したい写真があれば、ここからいつでも送れます。", href: "#materials", label: "写真を確認・追加する" };
      case "reviewing_materials":
        return { title: "担当者が写真とお話を確認中", copy: "確認が終わるまでお待ちください。伝え忘れたことはメッセージで送れます。", href: "#messages", label: "担当者へ連絡する" };
      case "concepts_ready":
        return { title: "2つの物語から1案を選択", copy: "気になる案を選び、制作希望を送信してください。", href: "#concepts", label: "コンセプトを選ぶ" };
      case "concept_selected":
        return { title: "選んだ物語を確認", copy: "映像制作へ進む前なら、もう一方の案へ変更できます。", href: "#concepts", label: "選択した案を見る" };
      case "production":
        return { title: "映像を制作しています", copy: "担当者が約1分の映像に仕上げています。追加のご連絡はこちらから送れます。", href: "#messages", label: "担当者へ連絡する" };
      case "customer_review":
      case "revision_requested":
      case "quality_check":
        return reviewAsset
          ? order.status === "quality_check"
            ? { title: "映像の確定を受け付けました", copy: "担当者が承認記録を確認し、最終納品の準備を進めています。", href: "#review-video", label: "確定した映像を見る" }
            : { title: order.status === "revision_requested" ? "修正内容を反映しています" : "完成前の映像を確認", copy: order.status === "revision_requested" ? "修正版の公開まで、現在の映像を確認できます。" : "映像を見て、修正を依頼するか、この映像で確定してください。", href: "#review-video", label: "確認映像を見る" }
          : { title: "仕上がりを確認中", copy: "最終確認が終わり次第、この制作室でお知らせします。", href: "#messages", label: "担当者へ連絡する" };
      case "delivered":
        return { title: "映画とメモリーサイトが完成", copy: "完成映像と写真アルバムを、いつでも見返せます。", href: "#delivery", label: "完成した映画を見る" };
      case "cancelled":
        return { title: "このご相談は停止中です", copy: "再開や確認をご希望の場合は、担当者へメッセージをお送りください。", href: "#messages", label: "担当者へ連絡する" };
    }
  }, [order, reviewAsset]);

  useEffect(() => {
    if (!conceptReceipt) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConceptReceipt(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [conceptReceipt]);

  const confirmConcept = async () => {
    if (!order || !canOperateOrder || !pendingConceptSlot || !pendingConcept || !canEditConcept) return;
    const slot = pendingConceptSlot;
    const conceptTitle = pendingConcept.title;
    setError("");
    setNotice("");
    setConfirmingConcept(true);
    const { error: selectError } = await getSupabaseBrowserClient().rpc("select_memory_concept", { p_order_id: order.id, p_slot: slot });
    if (selectError) {
      setError("コンセプトを送信できませんでした。もう一度お試しください。");
      setConfirmingConcept(false);
      return;
    }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, selected_concept_slot: slot, status: "concept_selected", stage_updated_at: new Date().toISOString() } : item));
    setConceptReceipt({ slot, title: conceptTitle });
    setConfirmingConcept(false);
  };

  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!user || !order || !canAddPhotos) return;
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
    if (!user || !order || !canOperateOrder || !messageBody.trim()) return;
    const { error: messageError } = await getSupabaseBrowserClient().from("messages").insert({ order_id: order.id, sender_id: user.id, body: messageBody.trim() });
    if (messageError) { setError("メッセージを送信できませんでした。"); return; }
    setMessageBody("");
    await loadDetails(order.id);
  };

  const requestRevision = async (event: FormEvent) => {
    event.preventDefault();
    if (!order || !canOperateOrder || !revisionBody.trim()) return;
    const { error: revisionError } = await getSupabaseBrowserClient().rpc("request_order_revision", { p_order_id: order.id, p_category: revisionCategory, p_body: revisionBody.trim() });
    if (revisionError) { setError(revisionError.message.includes("revision limit reached") ? "プラン内の修正回数を使い切っています。追加のご希望はメッセージでご相談ください。" : revisionError.message.includes("previous revision is still open") ? "前回の修正対応が完了するまでお待ちください。" : "修正依頼を送信できませんでした。"); return; }
    setRevisionBody("");
    setNotice("修正依頼を受け付けました。");
    await Promise.all([loadOrders(), loadDetails(order.id)]);
  };

  const acceptCurrentConsents = async () => {
    const peopleDetailsComplete = renewContainsPeople === "none" || (renewContainsPeople === "included" && Boolean(renewPeopleHandling) && Boolean(renewContainsMinors));
    const conditionalConsentsComplete = renewContainsPeople !== "included" || (consentPeopleChecked && (renewContainsMinors !== "included" || consentGuardianChecked));
    if (!order || !canOperateOrder || !consentTermsChecked || !consentPhotoRightsChecked || !consentAiChecked || !peopleDetailsComplete || !conditionalConsentsComplete) return;
    setAcceptingConsent(true);
    setError("");
    const { error: consentError } = await getSupabaseBrowserClient().rpc("accept_order_consents", {
      p_order_id: order.id,
      p_terms_version: CONSENT_VERSIONS.terms,
      p_privacy_version: CONSENT_VERSIONS.privacy,
      p_ai_notice_version: CONSENT_VERSIONS.aiNotice,
      p_photo_rights_consent_version: CONSENT_VERSIONS.photoRights,
      p_depicted_people_consent_version: CONSENT_VERSIONS.depictedPeople,
      p_minor_guardian_consent_version: CONSENT_VERSIONS.minorGuardian,
      p_people_policy_version: CONSENT_VERSIONS.peoplePolicy,
      p_contains_people: renewContainsPeople === "included",
      p_people_handling: renewContainsPeople === "none" ? "not_applicable" : renewPeopleHandling,
      p_contains_minors: renewContainsMinors === "included",
      p_consent_accepted: consentTermsChecked,
      p_photo_rights_consent_accepted: consentPhotoRightsChecked,
      p_depicted_people_consent_accepted: renewContainsPeople === "included" ? consentPeopleChecked : false,
      p_minor_guardian_consent_accepted: renewContainsMinors === "included" ? consentGuardianChecked : false,
      p_external_ai_consent_accepted: consentAiChecked,
    });
    if (consentError) setError("同意内容を記録できませんでした。もう一度お試しください。");
    else {
      setConsentTermsChecked(false);
      setConsentPhotoRightsChecked(false);
      setConsentPeopleChecked(false);
      setConsentGuardianChecked(false);
      setConsentAiChecked(false);
      setNotice("写真・人物の取り扱いと外部サービス利用への同意を記録しました。");
      await loadOrders();
    }
    setAcceptingConsent(false);
  };

  const approveReview = async () => {
    if (!order || !canOperateOrder || !approvalChecked || !reviewVideoUrl || hasOpenRevisions || !consentCurrent || order.payment_status !== "paid") return;
    setApprovingReview(true);
    setError("");
    const { error: approvalError } = await getSupabaseBrowserClient().rpc("customer_approve_review", { p_order_id: order.id });
    if (approvalError) {
      setError(approvalError.message.includes("open revision") ? "対応中の修正依頼があります。反映完了後に確定してください。" : approvalError.message.includes("payment") ? "入金確認が完了していません。担当者へご確認ください。" : "映像を確定できませんでした。もう一度お試しください。");
    } else {
      setApprovalChecked(false);
      setNotice("この映像で確定しました。担当者が最終納品の準備を進めます。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setApprovingReview(false);
  };

  if (authLoading || loading || !user) return <div className="wizard-loading">制作室を準備しています…</div>;

  return (
    <main className="studio-page">
      <header className="studio-header">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">WM</span><span className="brand-type">WAN MEMORY<small>MEMORY MOVIES FOR YOUR DOG</small></span></Link>
        <nav><Link href="/">ホーム</Link>{!readOnlyPreview && <Link href="/story">新しい相談</Link>}{profile?.role === "admin" && <Link href="/admin">運営管理</Link>}<button type="button" onClick={async () => { await signOut(); router.push("/"); }}>ログアウト</button><span className="avatar">{(profile?.full_name || user.email || "U").slice(0, 1).toUpperCase()}</span></nav>
      </header>
      {received && <div className="received-banner"><span aria-hidden="true">✓</span><div><strong>ご相談と写真を受け付けました。</strong><p>ここから追加写真、コンセプト選択、映像確認、お届けまで進められます。</p></div></div>}
      {conceptReceipt && <div className="concept-receipt-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setConceptReceipt(null); }}><section className="concept-receipt-dialog" role="alertdialog" aria-modal="true" aria-labelledby="concept-receipt-title" aria-describedby="concept-receipt-copy"><div className="concept-receipt-film" aria-hidden="true"><i /><i /><span>WM</span><i /><i /></div><p className="eyebrow">SELECTION RECEIVED · CONCEPT {conceptReceipt.slot}</p><h2 id="concept-receipt-title">コンセプトをお預かりしました。</h2><p id="concept-receipt-copy">「{conceptReceipt.title}」で制作希望を送信しました。担当者が内容を確認し、次の準備を進めますので、少しお待ちください。</p><aside><strong>制作が始まる前なら変更できます</strong><span>制作室が「映像制作」へ進む前は、もう一方の案を選んで再送信できます。</span></aside><button autoFocus className="button button-primary" type="button" onClick={() => setConceptReceipt(null)}>制作室に戻る →</button></section></div>}
      <div className="studio-shell">
        <div className="studio-account-bar"><div><small>ACCOUNT</small><strong>{profile?.full_name || user.email}</strong></div>{orders.length > 1 && <label><span>制作中の映画</span><select value={selectedOrderId} onChange={(event) => { setSelectedOrderId(event.target.value); setPendingConceptSlot(null); setConceptReceipt(null); setApprovalChecked(false); setRenewContainsPeople(""); setRenewPeopleHandling(""); setRenewContainsMinors(""); setConsentTermsChecked(false); setConsentPhotoRightsChecked(false); setConsentPeopleChecked(false); setConsentGuardianChecked(false); setConsentAiChecked(false); }}>{orders.map((item) => <option value={item.id} key={item.id}>{item.pet_name} · {item.order_number}</option>)}</select></label>}</div>

        {readOnlyPreview && <aside className="studio-preview-banner" role="status"><strong>運営用・顧客画面プレビュー</strong><span>閲覧専用です。コンセプト選択、写真追加、メッセージ、修正、承認、共有設定は操作できません。</span><Link href="/admin">運営管理へ戻る</Link></aside>}
        {error && <p className="studio-alert error" role="alert">{error}</p>}
        {notice && <p className="studio-alert" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></p>}

        {!order ? <section className="studio-empty"><p className="eyebrow">YOUR FILM STUDIO</p><h1>{profile?.primary_pet_name ? `${profile.primary_pet_name}ちゃんの思い出を` : "最初の思い出を"}<br />聞かせてください。</h1><p>お申し込み後、写真の追加から完成した映画のお届けまで、この制作室でご案内します。</p><Link className="button button-primary" href="/story">思い出づくりを始める →</Link></section> : <>
          <div className="studio-top"><div><p className="eyebrow">YOUR FILM STUDIO</p><h1>{order.pet_name}ちゃんの制作室</h1><p>写真の追加から完成まで、ひとつずつ進めます。</p></div><div className="order-meta"><span>ORDER</span><strong>{order.order_number}</strong><small>受付 {formatDate(order.created_at)}</small><small>料金 ¥{new Intl.NumberFormat("ja-JP").format(order.quoted_price)}（税込）</small><small>お支払い {order.payment_status === "paid" ? "入金確認済み" : order.payment_status === "invoice_sent" ? "ご案内済み" : order.payment_status === "refunded" ? "返金済み" : "内容確認後にご案内"}</small></div></div>

          {!consentCurrent && !["delivered", "cancelled"].includes(order.status) && <aside className="studio-consent-renewal" id="consent-renewal">
            <div><p className="eyebrow">CONSENT RECORD</p><h2>制作を続けるため、現在の内容をご確認ください。</h2><p>人物の写り込みと写真の利用条件を確認し、外部制作サービスで処理する前に、選択内容・同意日時・確認文のバージョンを注文へ記録します。</p></div>
            {canOperateOrder ? <>
              <fieldset className="studio-consent-question"><legend>お預けいただいた写真に人物は写っていますか？ <em>必須</em></legend><div><label><input type="radio" name="renewPeople" checked={renewContainsPeople === "none"} onChange={() => { setRenewContainsPeople("none"); setRenewPeopleHandling("not_applicable"); setRenewContainsMinors("none"); setConsentPeopleChecked(false); setConsentGuardianChecked(false); }} /><span>人物は写っていない</span></label><label><input type="radio" name="renewPeople" checked={renewContainsPeople === "included"} onChange={() => { setRenewContainsPeople("included"); setRenewPeopleHandling(""); setRenewContainsMinors(""); }} /><span>人物が写っている</span></label></div></fieldset>
              {renewContainsPeople === "included" && <div className="studio-people-consent-details">
                <fieldset className="studio-consent-question"><legend>人物の映像での取り扱い <em>必須</em></legend><div className="vertical"><label><input type="radio" name="renewHandling" checked={renewPeopleHandling === "dog_only_crop"} onChange={() => setRenewPeopleHandling("dog_only_crop")} /><span>愛犬だけを切り抜いて使用する（おすすめ）</span></label><label><input type="radio" name="renewHandling" checked={renewPeopleHandling === "anonymous_person"} onChange={() => setRenewPeopleHandling("anonymous_person")} /><span>顔が分からない後ろ姿・手元・足元・シルエットで表現する</span></label><label><input type="radio" name="renewHandling" checked={renewPeopleHandling === "original_still"} onChange={() => setRenewPeopleHandling("original_still")} /><span>元の家族写真をAIで動かさず、そのまま使用する</span></label><label><input type="radio" name="renewHandling" checked={renewPeopleHandling === "consult"} onChange={() => setRenewPeopleHandling("consult")} /><span>担当者に相談したい</span></label></div></fieldset>
                <fieldset className="studio-consent-question"><legend>未成年者は写っていますか？ <em>必須</em></legend><div><label><input type="radio" name="renewMinors" checked={renewContainsMinors === "none"} onChange={() => { setRenewContainsMinors("none"); setConsentGuardianChecked(false); }} /><span>写っていない</span></label><label><input type="radio" name="renewMinors" checked={renewContainsMinors === "included"} onChange={() => setRenewContainsMinors("included")} /><span>写っている</span></label></div></fieldset>
              </div>}
              <label><input type="checkbox" checked={consentTermsChecked} onChange={(event) => setConsentTermsChecked(event.target.checked)} /><span><Link href="/terms" target="_blank">利用規約</Link>（{CONSENT_VERSIONS.terms}）・<Link href="/privacy" target="_blank">プライバシーポリシー</Link>（{CONSENT_VERSIONS.privacy}）を確認し、同意します。</span></label>
              <label><input type="checkbox" checked={consentPhotoRightsChecked} onChange={(event) => setConsentPhotoRightsChecked(event.target.checked)} /><span>提出した写真を本サービスの映像制作に使用する権限を持っています（確認文 {CONSENT_VERSIONS.photoRights}）。</span></label>
              {renewContainsPeople === "included" && <label><input type="checkbox" checked={consentPeopleChecked} onChange={(event) => setConsentPeopleChecked(event.target.checked)} /><span>写真に写っているご本人から、本サービスの制作に使用する同意を得ています（確認文 {CONSENT_VERSIONS.depictedPeople}）。</span></label>}
              {renewContainsMinors === "included" && <label><input type="checkbox" checked={consentGuardianChecked} onChange={(event) => setConsentGuardianChecked(event.target.checked)} /><span>未成年者が写っている写真について、保護者から制作利用の同意を得ています（確認文 {CONSENT_VERSIONS.minorGuardian}）。</span></label>}
              <label><input type="checkbox" checked={consentAiChecked} onChange={(event) => setConsentAiChecked(event.target.checked)} /><span>映像制作のため、写真や制作情報が外部AIサービスで処理される場合があることを確認しました。WAN MEMORYが独自のAIモデル学習や広告・ポートフォリオ公開に使用することはありません。外部サービスでの取り扱いは各サービスの条件に基づきます（案内 {CONSENT_VERSIONS.aiNotice}）。</span></label>
              <button className="button button-primary" type="button" disabled={acceptingConsent || !consentTermsChecked || !consentPhotoRightsChecked || !consentAiChecked || !renewContainsPeople || (renewContainsPeople === "included" && (!renewPeopleHandling || !renewContainsMinors || !consentPeopleChecked || (renewContainsMinors === "included" && !consentGuardianChecked)))} onClick={acceptCurrentConsents}>{acceptingConsent ? "記録中…" : "同意内容を注文に記録する →"}</button>
            </> : <span>この表示は顧客画面でのみ操作できます。</span>}
          </aside>}

          {nextAction && <aside className="studio-next-action" aria-label="今やること"><div><p className="eyebrow">NEXT ACTION · 今やること</p><h2>{nextAction.title}</h2><span>{nextAction.copy}</span></div><a className="button button-primary" href={nextAction.href}>{nextAction.label} →</a></aside>}

          <section className="studio-status"><div className="status-copy"><span className="status-badge">現在のステップ {currentStep + 1} / {journeySteps.length}</span><h2>{ORDER_STATUS_LABELS[order.status]}</h2><p>{order.status === "delivered" ? "大切な映画をいつでもこちらでご覧いただけます。" : order.status === "concepts_ready" ? "方向性の異なる2つの物語から、その子らしい1案を選んでください。" : "進行が変わると、この制作室でお知らせします。追加したい思い出や写真はいつでもお送りください。"}</p><span className="estimate">予定完成日：{formatDate(order.due_date)}</span></div><div className="status-visual" aria-hidden="true"><div className="reel-circle"><span>WM</span></div><i /><i /><i /></div></section>

          <section className="timeline-card desktop-studio-timeline"><div className="card-head"><div><p className="eyebrow">PRODUCTION JOURNEY</p><h2>受付からお届けまで</h2></div><span>{ORDER_STATUS_LABELS[order.status]}</span></div><ol className="studio-timeline studio-timeline-seven">{journeySteps.map(([title, copy], index) => <li className={index <= currentStep ? "active" : ""} key={title}><span>{index < currentStep ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><small>{copy}</small></div></li>)}</ol></section>
          <details className="timeline-card mobile-studio-timeline"><summary><span><small>PRODUCTION JOURNEY</small><strong>受付からお届けまで</strong></span><i>7つの工程を見る</i></summary><ol className="studio-timeline studio-timeline-seven">{journeySteps.map(([title, copy], index) => <li className={index <= currentStep ? "active" : ""} key={title}><span>{index < currentStep ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><small>{copy}</small></div></li>)}</ol></details>

          {concepts.length > 0 && currentStep >= 2 && <section className="concept-section studio-card" id="concepts">
            <div className="card-head"><div><p className="eyebrow">CHOOSE YOUR FILM CONCEPT</p><h2>2つの物語から、1つを選ぶ</h2></div><span>{canEditConcept ? "案を選んだあと、下のボタンで送信します" : "制作が始まったため選択は確定しています"}</span></div>
            <div className="concept-grid">{concepts.map((concept) => <button type="button" disabled={!canEditConcept} aria-pressed={effectiveConceptSlot === concept.slot} className={effectiveConceptSlot === concept.slot ? "concept-option selected" : "concept-option"} onClick={() => { setPendingConceptSlot(concept.slot); setError(""); }} key={concept.id}><span className="concept-card-top"><span className="concept-label">CONCEPT {concept.slot}</span>{order.selected_concept_slot === concept.slot && <span className="concept-sent-tag">送信済み</span>}</span><strong>{concept.title}</strong><small>{concept.tone}</small><p>{concept.summary}</p><ol>{concept.scenes.map((scene, index) => <li key={`${concept.id}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{scene}</li>)}</ol><i aria-hidden="true">{effectiveConceptSlot === concept.slot ? "✓" : ""}</i></button>)}</div>
            <div className="concept-confirm"><p><span>{pendingConcept ? order.selected_concept_slot === pendingConcept.slot ? "送信済みの物語" : order.selected_concept_slot ? "変更する物語" : "選択中の物語" : "コンセプトを選択してください"}</span><strong>{pendingConcept?.title ?? "A・Bどちらかの案を選んでください"}</strong><small>{canEditConcept ? order.selected_concept_slot ? "映像制作へ進む前なら、何度でも変更できます。" : "カードを選んだだけでは送信されません。" : "映像制作へ進んだため、現在の案から変更できません。"}</small></p><button className="button button-cream" type="button" disabled={!canEditConcept || !pendingConcept || confirmingConcept || effectiveConceptSlot === order.selected_concept_slot} onClick={confirmConcept}>{confirmingConcept ? "送信中…" : !canEditConcept ? "選択は確定しています" : !pendingConcept ? "案を選んでください" : effectiveConceptSlot === order.selected_concept_slot ? "この案は送信済みです" : order.selected_concept_slot ? "この案に変更して送る →" : "この案で制作希望を送る →"}</button></div>
          </section>}

          {hasPendingConceptChange && pendingConcept && <aside className="mobile-concept-submit" aria-live="polite"><div><small>CONCEPT {pendingConcept.slot} を選択中</small><strong>{pendingConcept.title}</strong></div><button className="button button-cream" type="button" disabled={confirmingConcept} onClick={confirmConcept}>{confirmingConcept ? "送信中…" : "この案で送る →"}</button></aside>}

          {reviewAsset && order.status !== "delivered" && <section className="review-video-card" id="review-video"><div><p className="eyebrow">PRE-DELIVERY REVIEW</p><h2>{order.customer_approved_at ? "この映像で確定しました。" : "完成前の映像をご確認ください。"}</h2><p>{order.status === "revision_requested" ? "お送りいただいた修正内容を反映しています。新しい確認映像が届くまで、こちらが現在の版です。" : order.customer_approved_at ? `確定受付 ${formatDateTime(order.customer_approved_at)}。担当者が最終納品の準備を進めています。` : "この映像は確認用です。修正を依頼するか、問題がなければ「この映像で確定する」を押してください。"}</p><div className="revision-allowance"><strong>プラン内の修正</strong><span>残り {revisionsRemaining}回 / 全{order.revision_limit}回</span></div></div><div className="delivery-player">{reviewVideoUrl ? <video src={reviewVideoUrl} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline onContextMenu={(event) => event.preventDefault()} /> : <span>確認映像を準備しています…</span>}<small>確認専用 · この時点では最終納品ではありません</small></div>{order.status === "customer_review" && canOperateOrder && <div className="review-approval-panel"><p className="eyebrow">FINAL APPROVAL</p><h3>この映像で確定しますか？</h3>{hasOpenRevisions ? <aside className="revision-limit-note"><strong>対応中の修正依頼があります。</strong><span>修正版が公開され、対応完了になるまで確定できません。</span></aside> : <><label><input type="checkbox" checked={approvalChecked} disabled={!reviewVideoUrl} onChange={(event) => setApprovalChecked(event.target.checked)} /><span>現在表示されている確認映像を見て、この内容で最終納品へ進むことに同意します。</span></label><button className="button button-cream" type="button" disabled={!approvalChecked || approvingReview || !reviewVideoUrl || !consentCurrent || order.payment_status !== "paid"} onClick={approveReview}>{approvingReview ? "確定中…" : "この映像で確定する →"}</button>{!reviewVideoUrl && <small>確認映像の読み込み完了後に確定できます。</small>}{order.payment_status !== "paid" && <small>入金確認後に確定できます。担当者へご確認ください。</small>}{!consentCurrent && <small>上の同意内容を先に注文へ記録してください。</small>}</>}</div>}{order.status === "customer_review" && readOnlyPreview && <div className="review-approval-panel readonly"><strong>顧客画面ではここに「この映像で確定する」が表示されます。</strong><span>運営プレビューからは承認できません。</span></div>}</section>}

          {delivery && <section className="delivery-card" id="delivery"><div><p className="eyebrow light">YOUR FILM IS READY</p><h2>{delivery.title}</h2><p>{delivery.customer_message || `${order.pet_name}ちゃんとの時間を、一本の映画に仕上げました。`}</p><Link className="button button-cream" href={`/film/${order.id}`}>専用メモリーサイトを見る →</Link></div><div className="delivery-player">{videoUrl ? <video src={videoUrl} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline onContextMenu={(event) => event.preventDefault()} /> : <span>映像を準備しています…</span>}<small>閲覧専用 · ダウンロードボタンは表示されません</small></div></section>}

          <div className="studio-grid">
            <section className="studio-card" id="materials">
              <div className="card-head"><div><p className="eyebrow">YOUR DOG &amp; MATERIALS</p><h2>お預かりした内容</h2></div><span>{memories.length}件 · {sourceAssets.length}枚</span></div>
              <div className="pet-summary"><div className="pet-photo"><span>{order.pet_name.slice(0, 1)}</span></div><div><h3>{order.pet_name} <small>{order.breed}・{order.age_text}</small></h3><p>{order.purpose}</p><dl><div><dt>映像の雰囲気</dt><dd>{order.style}</dd></div><div><dt>思い出・写真</dt><dd>{memories.length}件 · {sourceAssets.length}枚</dd></div></dl></div></div>
              {memories.length > 0 && <div className="studio-memory-list">{memories.map((memory) => <article key={memory.id}><span>{String(memory.sort_order).padStart(2, "0")}</span><div><strong>{memory.title}</strong><p>{memory.description}</p><small>{memory.when_text || "時期指定なし"} · {memory.location || "場所指定なし"} · 写真{sourceAssets.filter((asset) => asset.memory_id === memory.id).length}枚</small></div></article>)}</div>}
              {order.message_to_pet && <blockquote>「{order.message_to_pet}」</blockquote>}
              {order.status === "awaiting_materials" && canOperateOrder ? <aside className="pending-order-submit"><div><strong>思い出と写真の入力が途中です。</strong><span>項目ごとの写真が分かるように、申込フォームから続きを入力してください。</span></div><Link className="button button-primary" href="/story">入力の続きを開く →</Link></aside> : canAddPhotos ? <label className={uploading ? "studio-upload-button disabled" : "studio-upload-button"}><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple disabled={uploading} onChange={addPhotos} /><span>＋ 補足写真を追加する</span><small>{uploading ? `送信中 ${uploadProgress}%` : "思い出に紐付かない追加資料としてお預かりします · 最大20枚"}</small></label> : <p className="readonly-preview-note">{readOnlyPreview ? "閲覧専用プレビューでは写真を追加できません。" : "停止中のご相談には写真を追加できません。"}</p>}
            </section>

            <aside className="studio-card message-card" id="messages"><p className="eyebrow">MESSAGE</p><h2>担当者とのメッセージ</h2><div className="message-thread">{messages.length ? messages.slice(-5).map((message) => { const fromCustomer = message.sender_id === order.user_id; return <article className={fromCustomer ? "mine" : ""} key={message.id}><small>{fromCustomer ? "あなた" : "担当ディレクター"} · {formatDate(message.created_at)}</small><p>{message.body}</p></article>; }) : <p className="message-empty">追加したい思い出やご質問をこちらから送れます。</p>}</div>{canOperateOrder ? <form className="message-form" onSubmit={sendMessage}><textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} rows={3} maxLength={3000} placeholder="担当者へ伝えたいこと" /><button className="button button-outline" type="submit" disabled={!messageBody.trim()}>メッセージを送る</button></form> : <p className="readonly-preview-note">閲覧専用プレビューではメッセージを送信できません。</p>}</aside>
          </div>

          {canOperateOrder ? <MemoryShareManager key={order.id} order={order} delivery={delivery} assets={assets} onChanged={() => loadDetails(order.id)} /> : delivery && <aside className="studio-card readonly-preview-note"><strong>専用メモリーサイト設定</strong><span>顧客画面では、納品後に写真アルバムと共有設定を変更できます。運営プレビューは閲覧専用です。</span></aside>}

          {(order.status === "customer_review" || order.status === "revision_requested" || revisions.length > 0) && <section className="studio-card revision-card" id="revision"><div className="card-head"><div><p className="eyebrow">REVISION REQUEST</p><h2>映像の修正について</h2></div><span>残り{revisionsRemaining}回 / 全{order.revision_limit}回</span></div>{revisions.length > 0 && <div className="revision-history">{revisions.map((revision) => <article key={revision.id}><span>{revision.status === "open" ? "対応中" : "反映済み"}</span><strong>{revision.category}</strong><p>{revision.body}</p></article>)}</div>}{order.status === "customer_review" && canOperateOrder && revisionsRemaining > 0 && !hasOpenRevisions && <form className="revision-form" onSubmit={requestRevision}><select value={revisionCategory} onChange={(event) => setRevisionCategory(event.target.value)}><option>映像の動き</option><option>愛犬の外見</option><option>リード・服・小物</option><option>BGM・字幕</option><option>その他</option></select><textarea required rows={4} value={revisionBody} onChange={(event) => setRevisionBody(event.target.value)} placeholder="例：リードが2本に見える場面を、1本だけ自然に首輪へつながるよう修正してください。" /><button className="button button-primary" type="submit">修正を依頼する →</button></form>}{order.status === "customer_review" && revisionsRemaining === 0 && <aside className="revision-limit-note"><strong>プラン内の修正2回を使用しました。</strong><span>追加の変更をご希望の場合は、担当者とのメッセージからご相談ください。</span></aside>}{(order.status === "revision_requested" || hasOpenRevisions) && <aside className="revision-limit-note"><strong>修正内容をお預かりしています。</strong><span>反映後、新しい確認映像をこの画面でお知らせします。</span></aside>}{readOnlyPreview && <p className="readonly-preview-note">閲覧専用プレビューでは修正を依頼できません。</p>}</section>}
        </>}
      </div>
    </main>
  );
}
