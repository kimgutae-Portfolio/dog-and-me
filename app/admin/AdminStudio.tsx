"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { hasCurrentConsent } from "../lib/consent";
import type { AppearancePolicy, FilmConcept, MemoryOrder, OrderAsset, OrderMemory, OrderMessage, PhotoAnalysisStatus, Profile, RevisionRequest } from "../lib/supabase/types";
import { getProductionFields, ORDER_STATUS_LABELS, type OrderStatus } from "../lib/supabase/types";

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

function safeArchiveSegment(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[-_]{2,}/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 80) || "file";
}

function archivePhotoName(asset: OrderAsset, index: number, role: string) {
  const extension = asset.original_filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")
    || (asset.mime_type === "image/jpeg" ? "jpg" : asset.mime_type.split("/").pop()?.replace(/[^a-z0-9]/g, "") || "bin");
  const stem = asset.original_filename.replace(/\.[^.]+$/, "");
  return `${String(index + 1).padStart(2, "0")}_${safeArchiveSegment(role)}_${safeArchiveSegment(stem)}.${extension}`;
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

function appearancePolicyLabel(value: AppearancePolicy | null) {
  if (value === "photo_era_by_scene") return "写真を撮った当時の姿を、場面ごとに残す";
  if (value === "current_appearance") return "現在の姿で全編を統一";
  if (value === "selected_period") return "特定の時期の姿で全編を統一";
  return "未確認（既存注文）";
}

function photoAnalysisStatusLabel(value: PhotoAnalysisStatus) {
  const labels: Record<PhotoAnalysisStatus, string> = {
    not_started: "未着手",
    ai_analysis_complete: "確認準備済み",
    pending_operator_review: "運営確認待ち",
    approved: "運営承認済み",
    needs_customer_input: "お客様へ追加確認が必要",
  };
  return labels[value];
}

export function AdminStudio() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState<MemoryOrder[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [concepts, setConcepts] = useState<FilmConcept[]>([]);
  const [assets, setAssets] = useState<OrderAsset[]>([]);
  const [memories, setMemories] = useState<OrderMemory[]>([]);
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
  const [exportingBundle, setExportingBundle] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
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
    const [conceptResult, assetResult, memoryResult, messageResult, revisionResult] = await Promise.all([
      supabase.from("concepts").select("*").eq("order_id", orderId).order("slot"),
      supabase.from("assets").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
      supabase.from("order_memories").select("*").eq("order_id", orderId).order("sort_order"),
      supabase.from("messages").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("revision_requests").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    ]);
    const loadedConcepts = (conceptResult.data ?? []) as FilmConcept[];
    const loadedAssets = (assetResult.data ?? []) as OrderAsset[];
    setConcepts(loadedConcepts);
    setAssets(loadedAssets);
    setMemories((memoryResult.data ?? []) as OrderMemory[]);
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
  const productionFields = useMemo(() => getProductionFields(order ?? {}), [order]);
  const customer = useMemo(() => customers.find((item) => item.id === order?.user_id), [customers, order?.user_id]);
  const sourceAssets = useMemo(() => assets.filter((asset) => asset.category === "source_image"), [assets]);
  const appearanceReferenceCards = useMemo(() => ([
    ["お顔の基準", productionFields.primaryFacePhotoId],
    ["全身の基準", productionFields.primaryBodyPhotoId],
    ["横向き・しっぽ", productionFields.sideTailPhotoId],
  ] as const).map(([label, assetId]) => ({ label, assetId, asset: sourceAssets.find((item) => item.id === assetId) ?? null })), [productionFields.primaryBodyPhotoId, productionFields.primaryFacePhotoId, productionFields.sideTailPhotoId, sourceAssets]);
  const selectedAppearanceAssets = useMemo(() => sourceAssets.filter((asset) => productionFields.selectedAppearancePhotoIds.includes(asset.id)), [productionFields.selectedAppearancePhotoIds, sourceAssets]);
  const reviewVideos = useMemo(() => assets.filter((asset) => asset.category === "review_video"), [assets]);
  const finalVideos = useMemo(() => assets.filter((asset) => asset.category === "final_video"), [assets]);
  const openMessages = useMemo(() => messages.filter((message) => message.sender_id === order?.user_id && message.status === "open"), [messages, order?.user_id]);
  const openRevisions = useMemo(() => revisions.filter((revision) => revision.status === "open"), [revisions]);
  const selectableStatuses = order ? statusOptions.filter(([value]) => {
    if (!allowedTransitions[order.status].includes(value)) return false;
    if (value !== order.status && ["production", "customer_review", "revision_requested", "quality_check"].includes(value) && order.payment_status !== "paid") return false;
    if (value !== order.status && ["concepts_ready", "concept_selected", "production", "customer_review", "revision_requested", "quality_check"].includes(value) && productionFields.photoAnalysisStatus !== "approved") return false;
    return true;
  }) : statusOptions;
  const consentCurrent = Boolean(order && hasCurrentConsent(order));
  const photoAnalysisApproved = productionFields.photoAnalysisStatus === "approved";
  const canUploadReview = Boolean(order && photoAnalysisApproved && order.payment_status === "paid" && consentCurrent && ["production", "revision_requested", "customer_review"].includes(order.status));
  const canUploadFinal = Boolean(order && photoAnalysisApproved && order.status === "quality_check" && order.payment_status === "paid" && consentCurrent && order.customer_approved_at && order.customer_approved_review_asset_id && openRevisions.length === 0);

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
    if (!photoAnalysisApproved) {
      setError("사진 분석에 대한 운영자 승인이 필요합니다. 승인 후 다음 제작 단계로 진행할 수 있습니다.");
      return;
    }
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

  const buildProductionExport = () => {
    if (!order) return null;
    const selectedConcept = concepts.find((concept) => concept.slot === order.selected_concept_slot) ?? null;
    const archivePhotos = sourceAssets.map((asset, index) => {
      const memory = memories.find((item) => item.id === asset.memory_id) ?? null;
      const roles: string[] = [];
      if (asset.id === productionFields.primaryFacePhotoId) roles.push("face_reference");
      if (asset.id === productionFields.primaryBodyPhotoId) roles.push("body_reference");
      if (asset.id === productionFields.sideTailPhotoId) roles.push("side_tail_reference");
      if (productionFields.selectedAppearancePhotoIds.includes(asset.id)) roles.push("selected_appearance_reference");
      if (memory) roles.push("memory_scene");
      if (roles.length === 0) roles.push("additional_photo");
      const archiveRole = memory ? `memory_${String(memory.sort_order).padStart(2, "0")}` : roles[0];
      const archiveFilename = archivePhotoName(asset, index, archiveRole);
      return {
        asset,
        archiveFilename,
        archivePath: `photos/${archiveFilename}`,
        roles,
        memory,
      };
    });
    const sourcePhotos = archivePhotos.map(({ asset, archiveFilename, archivePath, roles, memory }) => ({
      asset_id: asset.id,
      archive_filename: archiveFilename,
      archive_path: archivePath,
      original_filename: asset.original_filename,
      mime_type: asset.mime_type,
      file_size: asset.file_size,
      roles,
      memory: memory ? {
        number: memory.sort_order,
        title: memory.title,
      } : null,
    }));
    const productionData = {
      schema_version: "wan-memory-production-export-1.0",
      exported_at: new Date().toISOString(),
      production_ref: order.order_number,
      privacy_notice: "Account email, phone number, postal address, and customer profile name are not included. Customer-written story text may still contain personal information and must be handled only for this order.",
      workflow_stage: productionFields.photoAnalysisStatus === "approved" ? "photo_analysis_approved" : "photo_analysis_input",
      film: {
        purpose: order.purpose,
        duration_seconds: 60,
        aspect_ratio: order.aspect_ratio,
        style: order.style,
        bgm: order.bgm,
        narration: order.narration,
      },
      pet: {
        name: order.pet_name,
        name_kana: order.name_kana,
        breed: order.breed,
        age: order.age_text,
        personality: order.personality,
      },
      appearance_references: {
        primary_face_photo_id: productionFields.primaryFacePhotoId,
        primary_body_photo_id: productionFields.primaryBodyPhotoId,
        side_tail_photo_id: productionFields.sideTailPhotoId,
        appearance_policy: productionFields.appearancePolicy,
        selected_appearance_description: productionFields.selectedAppearanceDescription,
        selected_appearance_photo_ids: productionFields.selectedAppearancePhotoIds,
        owner_locked_traits: productionFields.ownerLockedTraits,
        operator_approved_at: productionFields.photoAnalysisApprovedAt,
      },
      source_photos: sourcePhotos,
      selected_concept: selectedConcept ? {
        slot: selectedConcept.slot,
        title: selectedConcept.title,
        tone: selectedConcept.tone,
        summary: selectedConcept.summary,
        scenes: selectedConcept.scenes,
      } : null,
      memories: memories.map((memory) => ({
        number: memory.sort_order,
        title: memory.title,
        when: memory.when_text,
        location: memory.location,
        description: memory.description,
        dog_behavior: memory.dog_behavior,
        photos: sourcePhotos
          .filter((photo) => photo.memory?.number === memory.sort_order)
          .map((photo) => ({ asset_id: photo.asset_id, archive_path: photo.archive_path, original_filename: photo.original_filename })),
      })),
      message_to_pet: order.message_to_pet,
      avoid_notes: order.avoid_notes,
      people_policy: {
        contains_people: order.contains_people,
        people_handling: order.people_handling,
        contains_minors: order.contains_minors,
        external_ai_processing_allowed: Boolean(order.external_ai_consent_at),
      },
      additional_customer_requests: messages.filter((message) => message.sender_id === order.user_id).map((message) => message.body),
      requested_gpt_output: {
        current_stage: "Analyze the submitted photos and application only. Do not create concepts or Runway prompts yet.",
        required_sections: [
          "observed_facts",
          "unknown_or_uncertain",
          "photo_roles",
          "representative_reference_photos",
          "identity_profile",
          "production_risks",
          "customer_questions",
          "can_proceed",
          "people_photo_assessment"
        ]
      }
    };
    const manifest = {
      schema_version: "wan-memory-photo-manifest-1.0",
      production_ref: order.order_number,
      photo_count: sourcePhotos.length,
      photos: sourcePhotos,
    };
    return { productionData, manifest, archivePhotos };
  };

  const copyProductionJson = async () => {
    if (!order) return;
    const exportData = buildProductionExport();
    if (!exportData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData.productionData, null, 2));
      setNotice("アカウントの連絡先を除いた分析・制作用JSONをコピーしました。");
    } catch {
      setError("制作用JSONをコピーできませんでした。ブラウザのクリップボード権限をご確認ください。");
    }
  };

  const downloadProductionBundle = async () => {
    const exportData = buildProductionExport();
    if (!order || !exportData || sourceAssets.length === 0) return;
    setExportingBundle(true);
    setExportProgress(`写真を準備しています（0/${sourceAssets.length}）`);
    setError("");
    try {
      const [{ strToU8, zip }, supabase] = await Promise.all([
        import("fflate"),
        Promise.resolve(getSupabaseBrowserClient()),
      ]);
      const root = safeArchiveSegment(order.order_number);
      const files: Record<string, Uint8Array> = {
        [`${root}/order.json`]: strToU8(JSON.stringify(exportData.productionData, null, 2)),
        [`${root}/photo-manifest.json`]: strToU8(JSON.stringify(exportData.manifest, null, 2)),
        [`${root}/GPT_INSTRUCTIONS.txt`]: strToU8([
          "Attach order.json and every file in the photos folder to GPT.",
          "Analyze only the application and photos at this stage.",
          "Do not create concept proposals or Runway prompts yet.",
          "Return the sections listed in requested_gpt_output inside order.json.",
          "Use asset_id and archive_path when referring to each photo."
        ].join("\n")),
      };
      for (let index = 0; index < exportData.archivePhotos.length; index += 1) {
        const item = exportData.archivePhotos[index];
        setExportProgress(`写真を準備しています（${index + 1}/${sourceAssets.length}）`);
        const { data, error: downloadError } = await supabase.storage.from("order-assets").download(item.asset.storage_path);
        if (downloadError || !data) throw new Error(`${item.asset.original_filename} download failed`, { cause: downloadError });
        files[`${root}/${item.archivePath}`] = new Uint8Array(await data.arrayBuffer());
      }
      setExportProgress("ZIPファイルを作成しています…");
      const archive = await new Promise<Uint8Array>((resolve, reject) => {
        zip(files, { level: 0 }, (zipError, result) => {
          if (zipError) reject(zipError);
          else resolve(result);
        });
      });
      const archiveBuffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
      const archiveUrl = URL.createObjectURL(new Blob([archiveBuffer], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = archiveUrl;
      link.download = `${root}-GPT-production-data.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(archiveUrl), 1000);
      setNotice(`制作用データをダウンロードしました。ZIPを展開し、order.jsonと写真${sourceAssets.length}枚をGPTへ添付してください。`);
    } catch (bundleError) {
      console.error(bundleError);
      setError("制作用データをダウンロードできませんでした。通信状態を確認して、もう一度お試しください。");
    } finally {
      setExportProgress("");
      setExportingBundle(false);
    }
  };

  const changePhotoAnalysisStatus = async (nextStatus: PhotoAnalysisStatus) => {
    if (!order) return;
    setSaving(true);
    setError("");
    const { error: statusError } = await getSupabaseBrowserClient().rpc("admin_set_photo_analysis_status", {
      p_order_id: order.id,
      p_status: nextStatus,
    });
    if (statusError) setError("写真確認の状態を変更できませんでした。現在の状態と入力内容をご確認ください。");
    else {
      setNotice(nextStatus === "approved" ? "写真と外見の基準を承認しました。次の制作工程へ進めます。" : "写真確認の状態を更新し、操作履歴へ記録しました。");
      await loadOrders();
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
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ orderId: order.id, body }),
    });
    const result = await response.json().catch(() => null) as { saved?: boolean; notificationSent?: boolean } | null;
    if (!response.ok || !result?.saved) {
      setError("メッセージを送信できませんでした。");
    } else {
      event.currentTarget.reset();
      setNotice(result.notificationSent
        ? "お客様へメッセージを送り、メールでお知らせしました。"
        : "メッセージは保存しましたが、メール通知を送れませんでした。Resendの設定・送信履歴をご確認ください。");
      await loadDetails(order.id);
    }
    setSaving(false);
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

            <section className="admin-card admin-photo-analysis" id="admin-photo-analysis">
              <div className="card-head"><div><p className="eyebrow">APPEARANCE REVIEW</p><h3>外見の基準と写真確認</h3></div><span className={`photo-analysis-status ${productionFields.photoAnalysisStatus}`}>{photoAnalysisStatusLabel(productionFields.photoAnalysisStatus)}</span></div>
              {productionFields.appearancePolicy === null && <aside className="admin-operation-note warning"><strong>既存形式の注文です。</strong><span>新しい外見基準が未入力のため、お客様への追加確認が必要です。</span></aside>}
              <div className="admin-reference-photo-grid">{appearanceReferenceCards.map(({ label, assetId, asset }) => <article key={label}><strong>{label}</strong>{asset && assetUrls[asset.id] ? <a href={assetUrls[asset.id]} target="_blank" rel="noreferrer"><span className="admin-photo-thumb" role="img" aria-label={`${label}写真`} style={{ backgroundImage: `url(${assetUrls[asset.id]})` }} /></a> : <span className="admin-reference-empty">{assetId ? "読み込み中" : "未選択"}</span>}<small>{asset?.original_filename ?? "—"}</small></article>)}</div>
              <dl className="admin-story"><div><dt>外見の適用方法</dt><dd>{appearancePolicyLabel(productionFields.appearancePolicy)}</dd></div>{productionFields.appearancePolicy === "selected_period" && <><div><dt>選んだ時期</dt><dd>{productionFields.selectedAppearanceDescription || "説明なし"}</dd></div><div><dt>時期の基準写真</dt><dd>{selectedAppearanceAssets.length ? selectedAppearanceAssets.map((asset) => asset.original_filename).join("、") : "未選択"}</dd></div></>}<div><dt>変わってほしくない特徴</dt><dd>{productionFields.ownerLockedTraits.length ? productionFields.ownerLockedTraits.join("、") : "指定なし"}</dd></div><div><dt>映画的な再構成の確認</dt><dd>{productionFields.aiReconstructionAcknowledged ? "確認済み" : "未確認"}</dd></div><div><dt>承認日時</dt><dd>{formatDateTime(productionFields.photoAnalysisApprovedAt)}</dd></div><div><dt>承認した運営者</dt><dd>{productionFields.photoAnalysisApprovedBy ? productionFields.photoAnalysisApprovedBy === user.id ? profile?.email || user.id : productionFields.photoAnalysisApprovedBy : "—"}</dd></div></dl>
              <div className="admin-photo-analysis-actions">
                {productionFields.photoAnalysisStatus === "pending_operator_review" && <><button className="button button-primary" type="button" disabled={saving} onClick={() => changePhotoAnalysisStatus("approved")}>写真分析を承認する →</button><button className="button button-outline" type="button" disabled={saving} onClick={() => changePhotoAnalysisStatus("needs_customer_input")}>お客様への確認が必要</button></>}
                {productionFields.photoAnalysisStatus === "needs_customer_input" && <button className="button button-outline" type="button" disabled={saving} onClick={() => changePhotoAnalysisStatus("pending_operator_review")}>追加内容を確認待ちに戻す</button>}
                {productionFields.photoAnalysisStatus === "approved" && <button className="button button-outline" type="button" disabled={saving} onClick={() => changePhotoAnalysisStatus("needs_customer_input")}>承認を取り消し、追加確認へ</button>}
              </div>
              {!photoAnalysisApproved && <aside className="admin-operation-note warning"><strong>次の制作工程は停止中です。</strong><span>사진 분석에 대한 운영자 승인이 필요합니다. 승인 후 다음 제작 단계로 진행할 수 있습니다.</span></aside>}
            </section>

            <aside className="admin-attention-summary" aria-label="未対応項目"><div><strong>{sourceAssets.length}</strong><span>お預かり写真</span></div><div className={openMessages.length ? "needs-action" : ""}><strong>{openMessages.length}</strong><span>未対応メッセージ</span></div><div className={openRevisions.length ? "needs-action" : ""}><strong>{openRevisions.length}</strong><span>未対応の修正</span></div><div><strong>{order.revision_used}/{order.revision_limit}</strong><span>使用済み修正回数</span></div></aside>

            <nav className="admin-mobile-sections" aria-label="管理項目"><a href="#admin-progress">進行</a><a href="#admin-story">内容</a><a href="#admin-photos">写真</a><a href="#admin-concepts">2案</a><a href="#admin-revisions">修正</a><a href="#admin-video">映像</a><a href="#admin-message">連絡</a></nav>

            <section className="admin-card" id="admin-progress"><div className="card-head"><div><p className="eyebrow">PRODUCTION STATUS</p><h3>進行状況・入金・納期</h3></div><span>許可された次の工程だけを表示</span></div>{order.payment_status !== "paid" && !["delivered", "cancelled"].includes(order.status) && <aside className="admin-operation-note warning"><strong>入金確認前です。</strong><span>「入金確認済み」を一度保存するまで、映像制作・確認映像公開・納品には進めません。</span></aside>}{!consentCurrent && !["delivered", "cancelled"].includes(order.status) && <aside className="admin-operation-note warning"><strong>写真・人物の取り扱いに必要な同意記録が揃っていません。</strong><span>お客様が制作室で人物・未成年者の有無、写真使用権限、写っている人物の同意、外部制作サービスでの処理を確認するまで制作を開始できません。</span></aside>}{order.customer_approved_at && <aside className="admin-operation-note strong"><strong>お客様が確認映像を確定済みです。</strong><span>{formatDateTime(order.customer_approved_at)} · 承認した確認映像ID {order.customer_approved_review_asset_id}</span></aside>}<div className="admin-form-grid"><label><span>現在の状態</span><select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>{selectableStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>入金状態</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as MemoryOrder["payment_status"])}><option value="pending">ご案内前</option><option value="invoice_sent">お支払い待ち</option><option value="paid">入金確認済み</option><option value="refunded">返金済み</option></select></label><label><span>予定完成日</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label className="wide"><span>運営メモ（顧客には非表示）</span><textarea rows={3} value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} /></label></div><button className="button button-primary" type="button" disabled={saving} onClick={saveOrder}>進行状況を保存</button></section>

            <section className="admin-card" id="admin-story"><div className="card-head"><div><p className="eyebrow">CUSTOMER STORY</p><h3>思い出と写真の組み合わせ</h3></div><div className="admin-export-actions"><button className="button button-outline admin-json-copy" type="button" disabled={saving || exportingBundle || sourceAssets.length === 0} onClick={copyProductionJson}>JSONだけコピー</button><button className="button button-primary admin-bundle-download" type="button" disabled={saving || exportingBundle || sourceAssets.length === 0} onClick={downloadProductionBundle}>{exportingBundle ? "準備中…" : "GPT制作用データをダウンロード"}</button></div></div>{exportProgress && <p className="admin-export-progress" role="status"><span aria-hidden="true" />{exportProgress}</p>}<aside className="admin-operation-note strong"><strong>写真分析の前から利用できます。</strong><span>注文JSON・写真対応表・元写真を1つのZIPにまとめます。ZIPを展開し、order.jsonとphotos内の写真をGPTへ添付してください。</span></aside><dl className="admin-story"><div><dt>映画の種類</dt><dd>{order.purpose}</dd></div><div><dt>犬種・年齢</dt><dd>{order.breed} · {order.age_text || "未入力"}</dd></div><div><dt>性格</dt><dd>{order.personality.join("、") || "未入力"}</dd></div><div><dt>思い出の項目</dt><dd>{memories.length ? `${memories.length}件` : "旧形式の受付"}</dd></div>{memories.length === 0 && <><div><dt>はじめて会った日</dt><dd>{order.first_meeting || "未入力"}</dd></div><div><dt>いちばんの思い出</dt><dd>{order.favorite_memory || "未入力"}</dd></div></>}<div><dt>伝えたい言葉</dt><dd>{order.message_to_pet || "未入力"}</dd></div><div><dt>入れたくないこと</dt><dd>{order.avoid_notes || "なし"}</dd></div><div><dt>人物の有無</dt><dd>{order.contains_people === true ? "あり" : order.contains_people === false ? "なし" : "未確認（制作不可）"}</dd></div><div><dt>人物の取り扱い</dt><dd>{peopleHandlingLabel(order.people_handling)}</dd></div><div><dt>未成年者</dt><dd>{order.contains_minors === true ? "あり" : order.contains_minors === false ? "なし" : "未確認（制作不可）"}</dd></div><div><dt>規約・Privacy同意</dt><dd>{order.consented_at ? `${formatDateTime(order.consented_at)} · 規約 ${order.terms_version} / Privacy ${order.privacy_version}` : "同意記録なし"}</dd></div><div><dt>写真使用権限</dt><dd>{order.photo_rights_consented_at ? `${formatDateTime(order.photo_rights_consented_at)} · ${order.photo_rights_consent_version}` : "同意記録なし"}</dd></div><div><dt>写っている人物の同意</dt><dd>{order.contains_people === false ? "対象外" : order.depicted_people_consented_at ? `${formatDateTime(order.depicted_people_consented_at)} · ${order.depicted_people_consent_version}` : "同意記録なし"}</dd></div><div><dt>未成年者の保護者同意</dt><dd>{order.contains_minors === false ? "対象外" : order.minor_guardian_consented_at ? `${formatDateTime(order.minor_guardian_consented_at)} · ${order.minor_guardian_consent_version}` : "同意記録なし"}</dd></div><div><dt>外部AI処理同意</dt><dd>{order.external_ai_consent_at ? `${formatDateTime(order.external_ai_consent_at)} · Notice ${order.ai_notice_version}` : "同意記録なし"}</dd></div></dl>{memories.length > 0 && <div className="admin-memory-list">{memories.map((memory) => { const memoryPhotos = sourceAssets.filter((asset) => asset.memory_id === memory.id); return <article key={memory.id}><header><span>MEMORY {String(memory.sort_order).padStart(2, "0")}</span><strong>{memory.title}</strong><small>{memoryPhotos.length}枚</small></header><dl><div><dt>時期</dt><dd>{memory.when_text || "指定なし"}</dd></div><div><dt>場所</dt><dd>{memory.location || "指定なし"}</dd></div><div><dt>詳しい内容</dt><dd>{memory.description}</dd></div><div><dt>表情・動き</dt><dd>{memory.dog_behavior}</dd></div></dl><div className="admin-memory-photos">{memoryPhotos.map((asset) => <a href={assetUrls[asset.id]} target="_blank" rel="noreferrer" key={asset.id}>{assetUrls[asset.id] ? <span className="admin-photo-thumb" role="img" aria-label={`${memory.title}の写真`} style={{ backgroundImage: `url(${assetUrls[asset.id]})` }} /> : <span>読み込み中</span>}<small>{asset.original_filename}</small></a>)}</div><p className="admin-memory-check">内容と写真が同じ場面か、服・場所・季節が一致するか確認してください。</p></article>; })}</div>}</section>

            <section className="admin-card" id="admin-photos"><div className="card-head"><div><p className="eyebrow">CUSTOMER PHOTOS</p><h3>写真一覧</h3></div><span>{sourceAssets.length}枚</span></div>{sourceAssets.length ? <><div className="admin-photo-grid">{sourceAssets.map((asset) => <a href={assetUrls[asset.id]} target="_blank" rel="noreferrer" aria-label={`${asset.original_filename}を大きく表示`} key={asset.id}>{assetUrls[asset.id] ? <span className="admin-photo-thumb" role="img" aria-label={`${order.pet_name}ちゃんの提出写真`} style={{ backgroundImage: `url(${assetUrls[asset.id]})` }} /> : <span>読み込み中</span>}<small>{asset.original_filename}{asset.memory_id ? " · 思い出に紐付け済み" : " · 追加写真"}</small></a>)}</div><p className="admin-operation-note">思い出ごとの対応関係は、上の「思い出と写真の組み合わせ」で確認できます。</p></> : <p className="admin-empty-copy">写真はまだ登録されていません。思い出ごとに1〜5枚、合計5枚以上の提出が必要です。</p>}</section>

            <section className="admin-card" id="admin-concepts"><div className="card-head"><div><p className="eyebrow">CONCEPT DELIVERY</p><h3>映像コンセプト2案</h3></div><span>{concepts.length}/2 保存済み</span></div><div className="admin-concepts">{([['A', conceptA, setConceptA], ['B', conceptB, setConceptB]] as const).map(([slot, value, setter]) => <div key={slot}><strong>CONCEPT {slot}</strong><label><span>タイトル</span><input value={value.title} onChange={(event) => setter({ ...value, title: event.target.value })} placeholder={`${order.pet_name}と歩いた季節`} /></label><label><span>トーン</span><input value={value.tone} onChange={(event) => setter({ ...value, tone: event.target.value })} placeholder="やさしく、映画のように" /></label><label><span>概要</span><textarea rows={4} value={value.summary} onChange={(event) => setter({ ...value, summary: event.target.value })} /></label><label><span>シーン（1行に1つ）</span><textarea rows={5} value={value.scenes} onChange={(event) => setter({ ...value, scenes: event.target.value })} placeholder={"はじめて会った日\nいつもの散歩道\n家族を待つ時間"} /></label></div>)}</div><button className="button button-primary" type="button" disabled={saving || !photoAnalysisApproved} onClick={saveConcepts}>2案を顧客へ公開する →</button></section>

            <section className="admin-card" id="admin-revisions"><div className="card-head"><div><p className="eyebrow">REVISION REQUESTS</p><h3>修正依頼</h3></div><span>{order.revision_used}/{order.revision_limit}回使用</span></div>{revisions.length ? <div className="admin-work-list">{revisions.map((revision) => <article key={revision.id}><div><span className={revision.status === "open" ? "work-status open" : "work-status"}>{revision.status === "open" ? "対応が必要" : "対応済み"}</span><small>{formatDate(revision.created_at)}</small></div><strong>{revision.category}</strong><p>{revision.body}</p>{revision.status === "open" && <button className="button button-outline" type="button" disabled={saving} onClick={() => resolveRevision(revision.id)}>対応完了にする</button>}</article>)}</div> : <p className="admin-empty-copy">修正依頼はまだありません。</p>}<p className="admin-operation-note">修正版を「完成前の確認映像」として公開してから、該当依頼を対応完了にしてください。上限はDBでも{order.revision_limit}回に制限されています。</p></section>

            <section className="admin-card" id="admin-video"><div className="card-head"><div><p className="eyebrow">VIDEO WORKFLOW</p><h3>{videoMode === "review" ? "完成前の確認映像" : "完成映像の最終納品"}</h3></div><span>MP4 / MOV / WebM</span></div><div className="admin-video-tabs"><button type="button" className={videoMode === "review" ? "active" : ""} onClick={() => { setVideoMode("review"); clearVideo(); }}>1. 顧客確認用</button><button type="button" className={videoMode === "final" ? "active" : ""} onClick={() => { setVideoMode("final"); clearVideo(); }}>2. 最終納品</button></div>{videoMode === "review" ? <><aside className="admin-operation-note strong"><strong>このアップロードでは納品済みになりません。</strong><span>お客様の制作室に確認映像を表示し、状態を「完成前の映像をご確認ください」へ進めます。</span></aside>{!canUploadReview && <aside className="admin-operation-note warning"><strong>確認映像を公開できません。</strong><span>{order.payment_status !== "paid" ? "先に入金確認を保存してください。" : !consentCurrent ? "お客様による現在版の同意記録が必要です。" : "コンセプト選択後、進行状況を「約1分の映画を制作しています」へ進めてください。"}</span></aside>}</> : <><div className="admin-form-grid"><label><span>映画タイトル</span><input value={deliveryTitle} onChange={(event) => setDeliveryTitle(event.target.value)} /></label><label className="wide"><span>お客様へのメッセージ</span><textarea rows={3} value={deliveryMessage} onChange={(event) => setDeliveryMessage(event.target.value)} /></label></div>{!canUploadFinal && <aside className="admin-operation-note warning"><strong>まだ最終納品できません。</strong><span>{order.payment_status !== "paid" ? "入金確認が必要です。" : !consentCurrent ? "現在版の同意記録が必要です。" : openRevisions.length ? "未対応の修正依頼をすべて解決してください。" : !order.customer_approved_at ? "お客様が確認映像の「この映像で確定する」を押すまでお待ちください。" : "お客様が承認した映像と制作工程を確認してください。"}</span></aside>}</>}<label className={saving || (videoMode === "review" ? !canUploadReview : !canUploadFinal) ? "admin-video-upload disabled" : "admin-video-upload"}><input key={videoInputKey} type="file" accept="video/mp4,video/quicktime,video/webm" disabled={saving || (videoMode === "review" ? !canUploadReview : !canUploadFinal)} onChange={selectVideo} /><strong>{videoFile ? "別の映像を選ぶ" : videoMode === "review" ? "確認映像を選ぶ" : "完成映像を選ぶ"}</strong><small>選択しただけでは公開・納品されません。次の確認欄で確定します。</small></label>{videoFile && <div className="admin-delivery-review" role="group" aria-label="映像アップロードの最終確認"><p className="eyebrow">UPLOAD CHECK</p><h4>{videoMode === "review" ? "まだ顧客へ公開されていません" : "まだ納品されていません"}</h4><dl><div><dt>お客様</dt><dd>{order.pet_name}ちゃん · {customer?.full_name || customer?.email || "登録ユーザー"}</dd></div><div><dt>ファイル</dt><dd>{videoFile.name}</dd></div><div><dt>サイズ</dt><dd>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</dd></div><div><dt>用途</dt><dd>{videoMode === "review" ? "完成前の顧客確認" : "最終納品"}</dd></div></dl><label className="admin-delivery-check"><input type="checkbox" checked={videoChecked} onChange={(event) => setVideoChecked(event.target.checked)} /><span>お客様名・ファイル名・用途を確認しました</span></label><div><button className="button button-outline" type="button" disabled={saving} onClick={clearVideo}>選び直す</button><button className="button button-primary" type="button" disabled={saving || !videoChecked || (videoMode === "review" ? !canUploadReview : !canUploadFinal)} onClick={uploadVideo}>{saving ? "アップロード中…" : videoMode === "review" ? "確認映像として公開する →" : "確認した内容で納品する →"}</button></div></div>}{reviewVideos.length > 0 && <div className="admin-video-history"><strong>公開済みの確認映像</strong>{reviewVideos.map((asset) => <a href={assetUrls[asset.id]} target="_blank" rel="noreferrer" key={asset.id}>{asset.original_filename}<small>{formatDate(asset.created_at)}</small></a>)}</div>}{videoMode === "final" && finalVideos.length > 0 && <div className="admin-video-history"><strong>登録済みの完成映像</strong>{finalVideos.map((asset) => <div className="admin-video-retry" key={asset.id}><a href={assetUrls[asset.id]} target="_blank" rel="noreferrer">{asset.original_filename}<small>{formatDate(asset.created_at)}</small></a><button className="button button-outline" type="button" disabled={saving || !canUploadFinal} onClick={() => retryDelivery(asset)}>この映像で納品を再試行</button></div>)}</div>}</section>

            <section className="admin-card" id="admin-message"><div className="card-head"><div><p className="eyebrow">MESSAGES</p><h3>お客様との連絡</h3></div><span>{openMessages.length}件 未対応</span></div><div className="admin-work-list admin-message-list">{messages.length ? messages.map((message) => { const fromCustomer = message.sender_id === order.user_id; return <article className={fromCustomer ? "customer" : "admin"} key={message.id}><div><span className={fromCustomer && message.status === "open" ? "work-status open" : "work-status"}>{fromCustomer ? message.status === "open" ? "未対応" : "対応済み" : "運営から送信"}</span><small>{formatDate(message.created_at)}</small></div><p>{message.body}</p>{fromCustomer && message.status === "open" && <button className="button button-outline" type="button" disabled={saving} onClick={() => resolveMessage(message.id)}>対応済みにする</button>}</article>; }) : <p className="admin-empty-copy">メッセージはまだありません。</p>}</div><form className="admin-message-form" onSubmit={sendMessage}><textarea name="body" rows={4} maxLength={3000} placeholder="追加写真のお願い、確認事項、進行状況など" /><button className="button button-outline" type="submit">メッセージを送る</button></form></section>
          </>}
        </section>
      </div>
    </main>
  );
}
