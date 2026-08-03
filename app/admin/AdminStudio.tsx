"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { hasCurrentConsent } from "../lib/consent";
import { APPLICATIONS_OPEN } from "../lib/site";
import type {
  FilmConcept,
  MemoryOrder,
  OrderAsset,
  OrderMemory,
  OrderMessage,
  PhotoAnalysisStatus,
  Profile,
  RenderProgressEvent,
  RevisionRequest,
  SecurityEvent,
} from "../lib/supabase/types";
import {
  getProductionFields,
  ORDER_STATUS_LABELS,
  SECURITY_EVENT_LABELS,
  type OrderStatus,
} from "../lib/supabase/types";

type ConceptDraft = {
  title: string;
  tone: string;
  summary: string;
  storyScenes: Record<string, string>;
};
type VideoMode = "review" | "final";
type AttentionCount = { messages: number; revisions: number };

const emptyConcept: ConceptDraft = {
  title: "",
  tone: "",
  summary: "",
  storyScenes: {},
};
const STORYBOOK_STYLE_PROFILE = {
  id: "storybook_watercolor_v1",
  dog_treatment:
    "soft painted dog with natural proportions, restrained watercolor and gouache texture",
  background_treatment:
    "rich illustrated environment with visible paper texture and clear story-specific atmosphere",
  transition_treatment:
    "background-only bridge page; carry one motif from the previous story into the next story",
  avoid: [
    "photorealistic dog",
    "oversized anime eyes",
    "tear stains or invented coat markings",
    "film blur",
    "film grain",
    "heavy vignette",
    "letterbox",
    "embedded text",
  ],
} as const;
const MEMORY_STORYBOOK_PRODUCTION_PROTOCOL = {
  id: "MEMORY STORYBOOK PRODUCTION",
  version: "2.0",
  prompt_filename: "MEMORY_STORYBOOK_PRODUCTION_v2.txt",
  source_photo_policy:
    "Use customer photos only as original-aspect-ratio references. Never pad, blur, crop, or send the raw photo directly to Runway.",
  page_image_policy:
    "Recompose each story as a new 16:9 watercolor-and-gouache storybook page while preserving the primary photo's identity and the story's visible facts.",
  story_pages: {
    count: 5,
    model: "gen4",
    duration_seconds: 5,
  },
  transition_pages: {
    count: 4,
    model: "gen4_turbo",
    duration_seconds: 5,
    dog_in_transition: false,
  },
} as const;
const MEMORY_STORYBOOK_PRODUCTION_PROMPT = `WAN MEMORY STORYBOOK PRODUCTION v2.0

역할
너는 WAN MEMORY의 그림책 제작 담당자다. 첨부된 order.json과 물語별 original 사진을 읽고, 고객의 실제 사진을 그대로 움직이는 대신 사진 속 사실과 기억을 수채·과슈 질감의 새로운 움직이는 그림책으로 재구성한다.

입력 자료
- order.json: job, style, production_protocol, stories, transition_rules, transitions, output_plan을 먼저 읽는다.
- stories/01-title/original/부터 stories/05-title/original/까지: 해당 물語에 연결된 고객 원본 사진이다.
- 파일명에 primary가 포함된 사진은 그 물語의 얼굴·체형·구도·장면 사실 기준이다.
- support 사진은 primary와 충돌하지 않는 세부만 보충한다.

가장 중요한 원본 사진 규칙
1. 고객 사진은 원래 비율과 해상도 그대로 참고한다.
2. 고객 사진을 패딩, 블러, 크롭, 레터박스 처리해서 16:9 복사본을 만들지 않는다.
3. 고객 원본 사진을 그대로 Runway에 보내지 않는다.
4. 16:9는 원본 사진의 변환 결과가 아니라, 네가 새로 만드는 그림책 페이지의 출력 비율이다.
5. 한 물語의 장소·계절·목줄·소품·털 특징을 다른 물語에서 가져오지 않는다.
6. 고객이 제공하지 않은 사실, 사람, 감정, 장소, 사건을 확정적으로 추가하지 않는다.

그림책 화풍과 정체성
- 강아지는 자연스러운 비율을 유지한 부드러운 painted dog로 그린다.
- 배경은 이야기의 장소와 계절이 읽히는 풍부한 수채·과슈 그림으로 만든다.
- 사진처럼 지나치게 실사화하지 않고, 과장된 애니메이션 눈·왜곡된 주둥이·새로운 털 무늬를 만들지 않는다.
- primary 사진의 얼굴, 눈 크기, 눈꺼풀, 귀, 주둥이, 털색, 꼬리, 목줄 등 보이는 특징을 유지한다.
- 눈물자국, 새로운 액세서리, 사람 얼굴, 다른 동물은 사진이나 order.json에 근거가 없으면 추가하지 않는다.
- 그림 안에 자막·로고·워터마크를 직접 넣지 않는다. 문장은 편집 단계에서 추가한다.

이야기 페이지 제작
- stories의 5개 물語를 모두 포함한다. 누락하거나 순서를 바꾸지 않는다.
- 각 물語마다 새로운 16:9 그림책 페이지 1장을 계획하고, 그 페이지를 바탕으로 Gen-4 5초 영상 프롬프트 1개를 작성한다.
- 한 장면에는 중심 행동 1개만 둔다. 작은 바람, 꽃잎, 물결, 커튼, 빛, 털끝처럼 움직임이 제한된 연출을 우선한다.
- 이야기 문장은 order.json의 문장과 고객 사실을 우선하며, 화면을 가리지 않는 짧은 일본어 한 문장으로 정리한다.
- 페이지를 만들기 전에 primary 사진과 story text가 서로 맞는지 확인한다.

연결 페이지 제작
- transitions의 4개 항목을 모두 만든다. 각 연결 페이지는 앞뒤 이야기의 색·빛·소품·공간을 이어주는 배경 페이지다.
- 연결 페이지에는 강아지, 사람, 새 동물을 넣지 않는다.
- 연결 페이지도 새로운 16:9 그림책 이미지로 만든다.
- 연결 페이지마다 Gen-4 Turbo 5초 프롬프트를 작성하고, 페이지 자체의 작은 움직임만 지정한다.

Runway 규칙
- 이야기 페이지: 승인된 16:9 그림책 페이지 이미지 + Gen-4 + 5초.
- 연결 페이지: 승인된 16:9 배경 페이지 이미지 + Gen-4 Turbo + 5초.
- raw 고객 사진은 Runway 입력으로 사용하지 않는다.
- 카메라 이동과 피사체 변형은 최소화한다. 눈·입·다리·꼬리의 큰 형태 변화, 새 물체 생성, 얼굴 변형, 갑작스러운 줌은 금지한다.
- 결과가 이상하면 프롬프트를 길게 늘리지 말고, 페이지 그림을 먼저 수정한 뒤 다시 영상화한다.

반드시 반환할 결과
1. memory_storybook_production_checklist: 5개 이야기와 4개 연결 페이지가 모두 포함됐는지 확인.
2. story_source_checklist: 각 primary/support 사진, 사용 이유, 충돌 여부.
3. story_page_image_plan: 이야기별 16:9 그림책 페이지의 장면·구도·화풍·문장.
4. transition_page_image_plan: 연결 페이지별 배경·색·모티프·움직임.
5. gen4_scene_prompts: 5개 이야기 페이지의 Gen-4 5초 프롬프트.
6. gen4_turbo_transition_prompts: 4개 연결 페이지의 Turbo 5초 프롬프트.
7. missing_information_only_if_blocking: 제작을 실제로 막는 경우에만 추가 질문.
8. people_photo_assessment: 사람이 포함된 원본을 어떻게 안전하게 처리했는지.

최종 검수
- 5개 이야기와 4개 연결 페이지가 모두 존재하는가?
- 모든 16:9 이미지가 고객 원본의 패딩·블러 복사본이 아니라 새 그림책 페이지인가?
- 각 이야기가 자기 물語의 사진과 사실만 사용했는가?
- 강아지 얼굴·체형·털·꼬리·목줄이 이야기마다 불필요하게 바뀌지 않았는가?
- 연결 페이지에 강아지나 사람이 들어가지 않았는가?
- Runway에는 승인된 그림책 페이지 이미지만 전달되는가?
- 막히지 않은 질문을 추가로 만들지 않았는가?
`;
const statusOptions = Object.entries(ORDER_STATUS_LABELS) as Array<
  [OrderStatus, string]
>;
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  awaiting_materials: ["awaiting_materials", "cancelled"],
  materials_submitted: [
    "materials_submitted",
    "reviewing_materials",
    "cancelled",
  ],
  reviewing_materials: ["reviewing_materials", "cancelled"],
  concepts_ready: ["concepts_ready", "reviewing_materials", "cancelled"],
  concept_selected: [
    "concept_selected",
    "concepts_ready",
    "stills_review",
    "cancelled",
  ],
  stills_review: ["stills_review", "concept_selected", "cancelled"],
  production: ["production", "concept_selected", "cancelled"],
  customer_review: ["customer_review", "production", "cancelled"],
  revision_requested: ["revision_requested", "production", "cancelled"],
  quality_check: [
    "quality_check",
    "production",
    "customer_review",
    "cancelled",
  ],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

function safeExtension(file: File) {
  return (
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "mp4"
  );
}

function safeArchiveSegment(value: string) {
  return (
    value
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "_")
      .replace(/[-_]{2,}/g, "_")
      .replace(/^[-_.]+|[-_.]+$/g, "")
      .slice(0, 80) || "file"
  );
}

function archivePhotoName(asset: OrderAsset, index: number, role: string) {
  const extension =
    asset.original_filename
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ||
    (asset.mime_type === "image/jpeg"
      ? "jpg"
      : asset.mime_type
          .split("/")
          .pop()
          ?.replace(/[^a-z0-9]/g, "") || "bin");
  const stem = asset.original_filename.replace(/\.[^.]+$/, "");
  return `${String(index + 1).padStart(2, "0")}_${safeArchiveSegment(role)}_${safeArchiveSegment(stem)}.${extension}`;
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "—";
}

function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}

function peopleHandlingLabel(value: MemoryOrder["people_handling"]) {
  const labels: Record<
    Exclude<MemoryOrder["people_handling"], null>,
    string
  > = {
    not_applicable: "該当なし",
    dog_only_crop: "愛犬だけを切り抜いて使用",
    anonymous_person: "顔が分からない後ろ姿・手元・足元・シルエットで表現",
    original_still: "元の家族写真をAIで動かさず使用",
    consult: "担当者へ相談",
  };
  return value ? labels[value] : "未確認";
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
  const [paymentStatus, setPaymentStatus] =
    useState<MemoryOrder["payment_status"]>("pending");
  const [dueDate, setDueDate] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [productionWorkMinutes, setProductionWorkMinutes] = useState(0);
  const [runwayCreditsUsed, setRunwayCreditsUsed] = useState(0);
  const [runwayGenerationCount, setRunwayGenerationCount] = useState(0);
  const [runwayRetryCount, setRunwayRetryCount] = useState(0);
  const [productionLog, setProductionLog] = useState("");
  const [deliveryTitle, setDeliveryTitle] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [videoMode, setVideoMode] = useState<VideoMode>("review");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoChecked, setVideoChecked] = useState(false);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [customerInputPending, setCustomerInputPending] = useState(false);
  const [stillFile, setStillFile] = useState<File | null>(null);
  const [stillTitle, setStillTitle] = useState("");
  const [stillCaption, setStillCaption] = useState("");
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>(
    {},
  );
  const [stillInputKey, setStillInputKey] = useState(0);
  const [clipInputKey, setClipInputKey] = useState(0);
  const [bgmTracks, setBgmTracks] = useState<string[]>([]);
  const [renderAvailable, setRenderAvailable] = useState(false);
  const [filmTitle, setFilmTitle] = useState("");
  const [filmKicker, setFilmKicker] = useState("A MOVING STORYBOOK");
  const [filmEndingText, setFilmEndingText] = useState("");
  const [filmEndingMark, setFilmEndingMark] = useState("WAN MEMORY");
  const [filmBgm, setFilmBgm] = useState("");
  const filmLetterbox = false;
  const filmLetterboxPct = 0;
  const filmLook = false;
  // Kept out of the shared `saving` flag so a multi-minute render never freezes
  // the message composer or the status form (same reasoning as exportProgress).
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState("");
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [mfaFactors, setMfaFactors] = useState<
    { id: string; friendly_name?: string; status: string }[]
  >([]);
  const [mfaEnrollment, setMfaEnrollment] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingBundle, setExportingBundle] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [filter, setFilter] = useState("all");
  const [attentionByOrder, setAttentionByOrder] = useState<
    Record<string, AttentionCount>
  >({});
  const messageComposerRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/admin");
  }, [authLoading, router, user]);

  const loadSecurity = useCallback(async () => {
    if (profile?.role !== "admin") return;
    const supabase = getSupabaseBrowserClient();
    const [eventsResult, factorsResult] = await Promise.all([
      supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.auth.mfa.listFactors(),
    ]);
    setSecurityEvents((eventsResult.data ?? []) as SecurityEvent[]);
    setMfaFactors(factorsResult.data?.totp ?? []);
  }, [profile?.role]);

  // Deferred to a macrotask for the same reason as the order-detail effect
  // below: loading synchronously inside the effect trips the cascading-render rule.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSecurity();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSecurity]);

  const startMfaEnrollment = async () => {
    setSaving(true);
    setError("");
    const { data, error: enrollError } =
      await getSupabaseBrowserClient().auth.mfa.enroll({ factorType: "totp" });
    if (enrollError || !data)
      setError("二段階認証の登録を開始できませんでした。");
    else
      setMfaEnrollment({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    setSaving(false);
  };

  const confirmMfaEnrollment = async () => {
    if (!mfaEnrollment) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: mfaEnrollment.factorId });
    if (challengeError || !challenge) {
      setError("認証コードを確認できませんでした。");
      setSaving(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaEnrollment.factorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    if (verifyError) {
      setError("認証コードが正しくありません。アプリの表示をご確認ください。");
      setSaving(false);
      return;
    }
    setMfaEnrollment(null);
    setMfaCode("");
    setNotice(
      "二段階認証を有効にしました。次回のログインから認証コードが必要になります。",
    );
    await loadSecurity();
    setSaving(false);
  };

  const removeMfaFactor = async (factorId: string) => {
    if (
      !window.confirm(
        "二段階認証を解除しますか？ 管理画面の保護が弱くなります。",
      )
    )
      return;
    setSaving(true);
    setError("");
    const { error: unenrollError } =
      await getSupabaseBrowserClient().auth.mfa.unenroll({ factorId });
    if (unenrollError) setError("二段階認証を解除できませんでした。");
    else {
      setNotice("二段階認証を解除しました。");
      await loadSecurity();
    }
    setSaving(false);
  };

  // The render endpoint only answers in the operator's local environment; this
  // is also how the UI knows whether to offer assembly at all.
  useEffect(() => {
    if (profile?.role !== "admin") return;
    let cancelled = false;
    fetch("/api/admin/render")
      .then(
        (response) =>
          response.json() as Promise<{
            available?: boolean;
            tracks?: string[];
          }>,
      )
      .then((result) => {
        if (cancelled) return;
        setRenderAvailable(Boolean(result.available));
        setBgmTracks(result.tracks ?? []);
      })
      .catch(() => {
        if (!cancelled) setRenderAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.role]);

  const loadOrders = useCallback(async () => {
    if (!user || profile?.role !== "admin") return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const [ordersResult, profilesResult, messageResult, revisionResult] =
      await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id,email,full_name,primary_pet_name,role"),
        supabase.from("messages").select("order_id").eq("status", "open"),
        supabase
          .from("revision_requests")
          .select("order_id")
          .eq("status", "open"),
      ]);
    if (ordersResult.error) setError("注文一覧を読み込めませんでした。");
    const loaded = (ordersResult.data ?? []) as MemoryOrder[];
    setOrders(loaded);
    setCustomers((profilesResult.data ?? []) as Profile[]);
    const attention: Record<string, AttentionCount> = {};
    const ensure = (orderId: string) =>
      (attention[orderId] ??= { messages: 0, revisions: 0 });
    for (const item of messageResult.data ?? [])
      ensure(item.order_id).messages += 1;
    for (const item of revisionResult.data ?? [])
      ensure(item.order_id).revisions += 1;
    setAttentionByOrder(attention);
    setSelectedOrderId((current) => current || loaded[0]?.id || "");
    setLoading(false);
  }, [profile?.role, user]);

  const loadDetails = useCallback(async (orderId: string) => {
    if (!orderId) return;
    const supabase = getSupabaseBrowserClient();
    const [
      conceptResult,
      assetResult,
      memoryResult,
      messageResult,
      revisionResult,
    ] = await Promise.all([
      supabase
        .from("concepts")
        .select("*")
        .eq("order_id", orderId)
        .order("slot"),
      supabase
        .from("assets")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_memories")
        .select("*")
        .eq("order_id", orderId)
        .order("sort_order"),
      supabase
        .from("messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at"),
      supabase
        .from("revision_requests")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
    ]);
    const loadedConcepts = (conceptResult.data ?? []) as FilmConcept[];
    const loadedAssets = (assetResult.data ?? []) as OrderAsset[];
    setConcepts(loadedConcepts);
    setAssets(loadedAssets);
    setCaptionDrafts(
      Object.fromEntries(
        loadedAssets
          .filter((asset) => asset.category === "scene_still")
          .map((asset) => [asset.id, asset.story_caption ?? ""]),
      ),
    );
    const loadedMemories = (memoryResult.data ?? []) as OrderMemory[];
    setMemories(loadedMemories);
    setMessages((messageResult.data ?? []) as OrderMessage[]);
    setRevisions((revisionResult.data ?? []) as RevisionRequest[]);
    const toDraft = (concept?: FilmConcept): ConceptDraft =>
      concept
        ? {
            title: concept.title,
            tone: concept.tone,
            summary: concept.summary,
            storyScenes: Object.fromEntries(
              loadedMemories.map((memory, index) => [
                memory.id,
                concept.story_scenes?.find(
                  (scene) => scene.memory_id === memory.id,
                )?.text ?? concept.scenes[index] ?? "",
              ]),
            ),
          }
        : {
            ...emptyConcept,
            storyScenes: Object.fromEntries(
              loadedMemories.map((memory) => [memory.id, ""]),
            ),
          };
    setConceptA(
      toDraft(loadedConcepts.find((concept) => concept.slot === "A")),
    );
    setConceptB(
      toDraft(loadedConcepts.find((concept) => concept.slot === "B")),
    );

    const signable = loadedAssets.filter(
      (asset) =>
        asset.category === "source_image" ||
        asset.category === "scene_still" ||
        asset.category === "render_clip" ||
        asset.category === "assembled_film" ||
        asset.category === "review_video" ||
        asset.category === "final_video",
    );
    const signed = await Promise.all(
      signable.map(async (asset) => {
        const { data } = await supabase.storage
          .from("order-assets")
          .createSignedUrl(asset.storage_path, 3600);
        return [asset.id, data?.signedUrl ?? ""] as const;
      }),
    );
    setAssetUrls(Object.fromEntries(signed));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (profile?.role === "admin") loadOrders();
      else if (!authLoading) setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, loadOrders, profile?.role]);

  const order = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );
  const productionFields = useMemo(
    () => getProductionFields(order ?? {}),
    [order],
  );
  const customer = useMemo(
    () => customers.find((item) => item.id === order?.user_id),
    [customers, order?.user_id],
  );
  const sourceAssets = useMemo(
    () => assets.filter((asset) => asset.category === "source_image"),
    [assets],
  );
  const sceneStills = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === "scene_still")
        .sort(
          (a, b) =>
            a.scene_sort_order - b.scene_sort_order ||
            a.created_at.localeCompare(b.created_at),
        ),
    [assets],
  );
  const allSceneCaptionsReady =
    sceneStills.length > 0 &&
    sceneStills.every((asset) => Boolean(asset.story_caption?.trim()));
  const reviewVideos = useMemo(
    () => assets.filter((asset) => asset.category === "review_video"),
    [assets],
  );
  const finalVideos = useMemo(
    () => assets.filter((asset) => asset.category === "final_video"),
    [assets],
  );
  const renderClips = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === "render_clip")
        .sort(
          (a, b) =>
            a.scene_sort_order - b.scene_sort_order ||
            a.created_at.localeCompare(b.created_at),
        ),
    [assets],
  );
  const assembledFilms = useMemo(
    () =>
      assets
        .filter((asset) => asset.category === "assembled_film")
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [assets],
  );
  const clipByStillId = useMemo(
    () =>
      new Map(
        renderClips.map((clip) => [clip.source_still_asset_id ?? "", clip]),
      ),
    [renderClips],
  );
  // Mirrors scripts/assemble_film.py: title page + n moving pages + ending
  // page, minus one 0.7s picture-book page cover per join.
  const estimatedSeconds = renderClips.length
    ? 3.0 + renderClips.length * 5.0 + 7.0 - 0.7 * (renderClips.length + 1)
    : 0;
  const openMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.sender_id === order?.user_id && message.status === "open",
      ),
    [messages, order?.user_id],
  );
  const openRevisions = useMemo(
    () => revisions.filter((revision) => revision.status === "open"),
    [revisions],
  );
  const selectableStatuses = order
    ? statusOptions.filter(([value]) => {
        if (!allowedTransitions[order.status].includes(value)) return false;
        if (
          value !== order.status &&
          [
            "stills_review",
            "production",
            "customer_review",
            "revision_requested",
            "quality_check",
          ].includes(value) &&
          order.payment_status !== "paid"
        )
          return false;
        if (
          value !== order.status &&
          [
            "concepts_ready",
            "concept_selected",
            "stills_review",
            "production",
            "customer_review",
            "revision_requested",
            "quality_check",
          ].includes(value) &&
          productionFields.photoAnalysisStatus !== "approved"
        )
          return false;
        return true;
      })
    : statusOptions;
  const consentCurrent = Boolean(order && hasCurrentConsent(order));
  const photoAnalysisApproved =
    productionFields.photoAnalysisStatus === "approved";
  const canManageStorySources = Boolean(
    order &&
      ["materials_submitted", "reviewing_materials"].includes(order.status) &&
      !photoAnalysisApproved,
  );
  const conceptPublishingStatusValid = Boolean(
    order &&
      ["materials_submitted", "reviewing_materials", "concepts_ready"].includes(
        order.status,
      ),
  );
  const canRequestPayment = Boolean(
    order &&
      order.status === "concept_selected" &&
      order.selected_concept_slot &&
      consentCurrent &&
      order.payment_status !== "paid" &&
      order.payment_status !== "refunded",
  );
  const canPrepareStills = Boolean(
    order &&
      photoAnalysisApproved &&
      order.payment_status === "paid" &&
      consentCurrent &&
      order.status === "concept_selected",
  );
  const canUploadReview = Boolean(
    order &&
      photoAnalysisApproved &&
      order.payment_status === "paid" &&
      consentCurrent &&
      ["production", "revision_requested", "customer_review"].includes(
        order.status,
      ),
  );
  const canUploadFinal = Boolean(
    order &&
      photoAnalysisApproved &&
      order.status === "quality_check" &&
      order.payment_status === "paid" &&
      consentCurrent &&
      order.customer_approved_at &&
      order.customer_approved_review_asset_id &&
      openRevisions.length === 0,
  );
  const canRenderFilm = Boolean(
    order &&
      photoAnalysisApproved &&
      order.payment_status === "paid" &&
      consentCurrent &&
      order.stills_approved_at &&
      ["production", "revision_requested"].includes(order.status),
  );

  useEffect(() => {
    if (!order) return;
    const timer = window.setTimeout(() => {
      setStatus(order.status);
      setPaymentStatus(order.payment_status);
      setDueDate(order.due_date ?? "");
      setAdminNotes(order.admin_notes ?? "");
      setProductionWorkMinutes(order.production_work_minutes ?? 0);
      setRunwayCreditsUsed(order.runway_credits_used ?? 0);
      setRunwayGenerationCount(order.runway_generation_count ?? 0);
      setRunwayRetryCount(order.runway_retry_count ?? 0);
      setProductionLog(order.production_log ?? "");
      setDeliveryTitle(`${order.pet_name}の動く絵本`);
      setDeliveryMessage(
        `${order.pet_name}ちゃんとの大切な時間を、一冊のような動く物語に仕上げました。`,
      );
      setVideoMode("review");
      setVideoFile(null);
      setVideoChecked(false);
      setVideoInputKey((current) => current + 1);
      setStillFile(null);
      setStillTitle("");
      setStillCaption("");
      setStillInputKey((current) => current + 1);
      setClipInputKey((current) => current + 1);
      setFilmTitle(`${order.pet_name}の、小さなものがたり`);
      // The customer's own words to their dog are the right starting point for
      // the ending card; the operator edits from there.
      setFilmEndingText(order.message_to_pet ?? "");
      setFilmBgm("");
      setRenderProgress("");
      setCustomerInputPending(false);
      loadDetails(order.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetails, order]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (messageListRef.current)
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, selectedOrderId]);

  const hasAttention = (orderId: string) => {
    const count = attentionByOrder[orderId];
    return Boolean(count && count.messages + count.revisions > 0);
  };
  const visibleOrders =
    filter === "all"
      ? orders
      : filter === "attention"
        ? orders.filter((item) => hasAttention(item.id))
        : orders.filter((item) => item.status === filter);
  const totalAttention = Object.values(attentionByOrder).reduce(
    (total, count) => total + count.messages + count.revisions,
    0,
  );

  const selectOrder = (orderId: string) => {
    if (orderId !== selectedOrderId) setMessageDraft("");
    setSelectedOrderId(orderId);
  };

  const changeFilter = (nextFilter: string) => {
    setFilter(nextFilter);
    const nextOrders =
      nextFilter === "all"
        ? orders
        : nextFilter === "attention"
          ? orders.filter((item) => hasAttention(item.id))
          : orders.filter((item) => item.status === nextFilter);
    if (
      nextOrders.length &&
      !nextOrders.some((item) => item.id === selectedOrderId)
    )
      selectOrder(nextOrders[0].id);
    if (!nextOrders.length) selectOrder("");
  };

  const saveOrder = async () => {
    if (!order) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const requestingPayment =
      order.payment_status !== "invoice_sent" &&
      paymentStatus === "invoice_sent";
    if (requestingPayment && !APPLICATIONS_OPEN) {
      setError("現在、お支払い受付は準備中のため案内を送信できません。");
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase.rpc("admin_update_order", {
      p_order_id: order.id,
      p_status: status,
      p_payment_status: paymentStatus,
      p_due_date: dueDate || null,
      p_admin_notes: adminNotes || null,
    });
    if (updateError) {
      setError(
        `進行状況を保存できませんでした。${
          updateError.message.includes("invalid order status transition")
            ? "許可されていない工程への移動です。"
            : updateError.message.includes(
                  "concept selection and current consent",
                )
              ? "構成案の選択と現在版の同意記録を確認してから、お支払いをご案内してください。"
              : updateError.message.includes("managed by Stripe")
                ? "入金・返金状態は決済結果から自動で反映されます。"
                : ""
        }`,
      );
    } else {
      let paymentEmailSent = false;
      if (requestingPayment) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) {
          const response = await fetch("/api/admin/payment-request", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ orderId: order.id }),
          });
          const result = (await response.json().catch(() => ({}))) as {
            sent?: boolean;
          };
          paymentEmailSent = response.ok && result.sent === true;
        }
      }
      setNotice(
        requestingPayment
          ? paymentEmailSent
            ? "制作室へお支払いボタンを表示し、案内メールを送りました。"
            : "制作室へお支払いボタンを表示しました。メール通知は送信できなかったため、メッセージでもお知らせください。"
          : "進行状況を保存し、履歴へ記録しました。",
      );
      await loadOrders();
    }
    setSaving(false);
  };

  const saveProductionMetrics = async () => {
    if (!order) return;
    setSaving(true);
    setError("");
    const { error: metricsError } = await getSupabaseBrowserClient().rpc(
      "admin_save_production_metrics",
      {
        p_order_id: order.id,
        p_work_minutes: Math.max(0, Math.trunc(productionWorkMinutes || 0)),
        p_runway_credits: Math.max(0, Math.trunc(runwayCreditsUsed || 0)),
        p_generation_count: Math.max(0, Math.trunc(runwayGenerationCount || 0)),
        p_retry_count: Math.max(0, Math.trunc(runwayRetryCount || 0)),
        p_notes: productionLog.trim() || null,
      },
    );
    if (metricsError)
      setError("制作メモを保存できませんでした。入力内容をご確認ください。");
    else {
      setNotice(
        "制作時間・Runway使用量を記録しました。初期10組の原価検証に利用できます。",
      );
      await loadOrders();
    }
    setSaving(false);
  };

  const saveConcepts = async () => {
    if (!photoAnalysisApproved) {
      setError(
        "사진 분석에 대한 운영자 승인이 필요합니다. 승인 후 다음 제작 단계로 진행할 수 있습니다.",
      );
      return;
    }
    if (
      !order ||
      !conceptA.title.trim() ||
      !conceptA.summary.trim() ||
      !conceptB.title.trim() ||
      !conceptB.summary.trim()
    ) {
      setError("物語案A・Bのタイトルと概要を入力してください。");
      return;
    }
    if (
      memories.length !== 5 ||
      [conceptA, conceptB].some((concept) =>
        memories.some((memory) => !concept.storyScenes[memory.id]?.trim()),
      )
    ) {
      setError(
        "構成案A・Bそれぞれに、5つすべての物語の場面を入力してください。",
      );
      return;
    }
    if (!conceptPublishingStatusValid) {
      setError(
        `現在の工程「${ORDER_STATUS_LABELS[order.status]}」では物語案を公開できません。注文の進行状況をご確認ください。`,
      );
      return;
    }
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    if (order.status === "materials_submitted") {
      const { error: reviewStartError } = await supabase.rpc(
        "admin_update_order",
        {
          p_order_id: order.id,
          p_status: "reviewing_materials",
          p_payment_status: order.payment_status,
          p_due_date: order.due_date,
          p_admin_notes: order.admin_notes,
        },
      );
      if (reviewStartError) {
        setError(
          "写真とお話の確認工程を開始できませんでした。画面を更新して、もう一度お試しください。",
        );
        setSaving(false);
        return;
      }
    }
    const conceptsPayload = (
      [
        ["A", conceptA],
        ["B", conceptB],
      ] as const
    ).map(([slot, value]) => ({
      slot,
      title: value.title.trim(),
      tone: value.tone.trim(),
      summary: value.summary.trim(),
      story_scenes: memories.map((memory) => ({
        memory_id: memory.id,
        text: value.storyScenes[memory.id].trim(),
      })),
    }));
    const { error: conceptError } = await supabase.rpc(
      "admin_publish_concepts",
      { p_order_id: order.id, p_concepts: conceptsPayload },
    );
    if (conceptError)
      setError(
        conceptError.message.includes("current status")
          ? "注文の状態が別の画面で変更されました。画面を更新して、現在の工程をご確認ください。"
          : "2案を公開できませんでした。入力内容と現在の制作工程をご確認ください。",
      );
    else {
      setNotice("2つの物語案を公開し、操作履歴へ記録しました。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const buildProductionExport = () => {
    if (!order) return null;
    const selectedConcept =
      concepts.find(
        (concept) => concept.slot === order.selected_concept_slot,
      ) ?? null;
    const orderedSourceAssets = [...sourceAssets].sort((a, b) => {
      const aMemory = memories.find((item) => item.id === a.memory_id);
      const bMemory = memories.find((item) => item.id === b.memory_id);
      return (
        (aMemory?.sort_order ?? 99) - (bMemory?.sort_order ?? 99) ||
        (a.memory_photo_sort_order ?? 99) -
          (b.memory_photo_sort_order ?? 99) ||
        a.album_sort_order - b.album_sort_order
      );
    });
    const archivePhotos = orderedSourceAssets.map((asset, index) => {
      const memory =
        memories.find((item) => item.id === asset.memory_id) ?? null;
      const photoPosition = asset.memory_photo_sort_order ?? 1;
      const roles = memory
        ? [
            "story_scene",
            photoPosition === 1 ? "primary_scene_source" : "supporting_reference",
          ]
        : ["additional_photo"];
      const archiveRole = memory
        ? `story_${String(memory.sort_order).padStart(2, "0")}_${
            photoPosition === 1 ? "primary" : `support_${photoPosition - 1}`
          }`
        : roles[0];
      const archiveFilename = archivePhotoName(asset, index, archiveRole);
      const storyFolder = memory
        ? `stories/${String(memory.sort_order).padStart(2, "0")}-${safeArchiveSegment(memory.title)}`
        : "additional";
      return {
        asset,
        archiveFilename,
        archivePath: `${storyFolder}/original/${archiveFilename}`,
        roles,
        memory,
        photoPosition,
      };
    });
    const sourcePhotos = archivePhotos.map(
      ({
        asset,
        archiveFilename,
        archivePath,
        roles,
        memory,
        photoPosition,
      }) => ({
        asset_id: asset.id,
        archive_filename: archiveFilename,
        archive_path: archivePath,
        original_filename: asset.original_filename,
        mime_type: asset.mime_type,
        file_size: asset.file_size,
        roles,
        story_photo_position: memory ? photoPosition : null,
        is_primary_scene_source: Boolean(memory && photoPosition === 1),
        memory: memory
          ? {
              number: memory.sort_order,
              title: memory.title,
            }
          : null,
      }),
    );
    const selectedStoryText = new Map(
      (selectedConcept?.story_scenes ?? []).map((scene) => [
        scene.memory_id,
        scene.text,
      ]),
    );
    const stories = memories.map((memory) => {
      const storyNumber = String(memory.sort_order).padStart(2, "0");
      const storyId = `story_${storyNumber}`;
      const storyPhotoDetails = sourcePhotos
        .filter((photo) => photo.memory?.number === memory.sort_order)
        .sort(
          (a, b) =>
            (a.story_photo_position ?? 99) -
            (b.story_photo_position ?? 99),
        )
        .map((photo) => ({
          asset_id: photo.asset_id,
          filename: photo.archive_filename,
          original_filename: photo.original_filename,
          role: photo.is_primary_scene_source
            ? "primary_scene_source"
            : "supporting_reference",
          position: photo.story_photo_position,
          archive_path: photo.archive_path,
        }));
      return {
        id: storyId,
        number: memory.sort_order,
        title: memory.title,
        caption:
          selectedStoryText.get(memory.id)?.trim() || memory.description,
        when: memory.when_text,
        location: memory.location,
        description: memory.description,
        dog_behavior: memory.dog_behavior,
        photos: storyPhotoDetails.map((photo) => photo.filename),
        photo_details: storyPhotoDetails,
        main_motif: null,
        main_motif_instruction:
          "Derive one visual motif from this story without adding customer facts.",
        output: {
          page_image_filename: `${storyId}.png`,
          runway_clip_filename: `${storyId}-video.mp4`,
          runway_model: "gen4",
          runway_duration_seconds: 5,
        },
      };
    });
    const transitions = memories.slice(0, -1).map((memory, index) => {
      const nextMemory = memories[index + 1];
      const fromNumber = String(memory.sort_order).padStart(2, "0");
      const toNumber = String(nextMemory.sort_order).padStart(2, "0");
      const transitionId = `transition_${fromNumber}_${toNumber}`;
      return {
        id: transitionId,
        from_story: `story_${fromNumber}`,
        to_story: `story_${toNumber}`,
        instruction:
          "Create a background-only bridge page that carries one motif from the previous story into the next story.",
        dog_in_transition: false,
        output: {
          page_image_filename: `${transitionId}.png`,
          runway_clip_filename: `${transitionId}-video.mp4`,
          runway_model: "gen4_turbo",
          runway_duration_seconds: 5,
        },
      };
    });
    const productionData = {
      schema_version: "wan-memory-storybook-production-export-3.0",
      exported_at: new Date().toISOString(),
      job: {
        id: order.order_number,
        pet_name: order.pet_name,
        name_kana: order.name_kana,
        breed: order.breed,
        age_text: order.age_text,
        purpose: order.purpose,
        workflow_stage:
          productionFields.photoAnalysisStatus === "approved"
            ? "story_sources_approved"
            : "story_sources_review",
      },
      style: {
        ...STORYBOOK_STYLE_PROFILE,
        customer_requested_style: order.style,
      },
      production_protocol: MEMORY_STORYBOOK_PRODUCTION_PROTOCOL,
      stories,
      transition_rules: {
        count: transitions.length,
        model: "gen4_turbo",
        duration_seconds: 5,
        dog_in_transition: false,
        page_turn_mode: "physical_page_turn_without_crossfade",
        page_turn_duration_seconds: 1.2,
        text_is_added_after_video: true,
      },
      transitions,
      output_plan: {
        story_count: stories.length,
        story_model: "gen4",
        story_duration_seconds: 5,
        transition_count: transitions.length,
        transition_model: "gen4_turbo",
        transition_duration_seconds: 5,
        title_card_seconds: 3,
        ending_card_seconds: 7,
      },
      production_ref: order.order_number,
      workflow_stage:
        productionFields.photoAnalysisStatus === "approved"
          ? "story_sources_approved"
          : "story_sources_review",
      privacy_notice:
        "Account email, phone number, postal address, and customer profile name are not included. Customer-written story text may still contain personal information and must be handled only for this order.",
      story_source_rules: {
        story_count: memories.length,
        photos_per_story: "1-3",
        primary_source_rule:
          "The first photo in every story is the required composition and identity anchor for that story only.",
        supporting_source_rule:
          "Photos 2-3 are optional supporting references. Do not combine details that conflict with the primary source.",
        global_appearance_reference: false,
        operator_approved_at: productionFields.photoAnalysisApprovedAt,
      },
      source_photos: sourcePhotos,
      selected_concept: selectedConcept
        ? {
            slot: selectedConcept.slot,
            title: selectedConcept.title,
            tone: selectedConcept.tone,
            summary: selectedConcept.summary,
            scenes: selectedConcept.scenes,
            story_scenes: selectedConcept.story_scenes,
          }
        : null,
      memories: memories.map((memory) => ({
        number: memory.sort_order,
        title: memory.title,
        when: memory.when_text,
        location: memory.location,
        description: memory.description,
        dog_behavior: memory.dog_behavior,
        photos: sourcePhotos
          .filter((photo) => photo.memory?.number === memory.sort_order)
          .sort(
            (a, b) =>
              (a.story_photo_position ?? 99) -
              (b.story_photo_position ?? 99),
          )
          .map((photo) => ({
            asset_id: photo.asset_id,
            role: photo.is_primary_scene_source
              ? "primary_scene_source"
              : "supporting_reference",
            position: photo.story_photo_position,
            archive_path: photo.archive_path,
            original_filename: photo.original_filename,
          })),
      })),
      message_to_pet: order.message_to_pet,
      avoid_notes: order.avoid_notes,
      people_policy: {
        face_usage_policy: "faces_never_generated_or_used_back_views_only",
        contains_people: order.contains_people,
        people_handling: order.people_handling,
        contains_minors: order.contains_minors,
        external_ai_processing_allowed: Boolean(order.external_ai_consent_at),
      },
      additional_customer_requests: messages
        .filter((message) => message.sender_id === order.user_id)
        .map((message) => message.body),
      requested_gpt_output: {
        current_stage:
          "Read job, style, production_protocol, stories, and transition_rules first. Follow MEMORY STORYBOOK PRODUCTION v2.0: create five new 16:9 storybook page images from the original-aspect-ratio customer references, then create four background-only transition page images. Keep story sources separate.",
        required_sections: [
          "memory_storybook_production_checklist",
          "story_source_checklist",
          "story_page_image_plan",
          "transition_page_image_plan",
          "gen4_scene_prompts",
          "gen4_turbo_transition_prompts",
          "missing_information_only_if_blocking",
          "people_photo_assessment",
        ],
      },
    };
    const manifest = {
      schema_version: "wan-memory-story-source-manifest-3.0",
      production_ref: order.order_number,
      story_count: memories.length,
      transition_count: transitions.length,
      photo_count: sourcePhotos.length,
      stories: stories.map((story) => ({
        id: story.id,
        title: story.title,
        photos: story.photos,
      })),
      transitions: transitions.map((transition) => ({
        id: transition.id,
        from_story: transition.from_story,
        to_story: transition.to_story,
      })),
      photos: sourcePhotos,
    };
    return { productionData, manifest, archivePhotos };
  };

  const copyProductionJson = async () => {
    if (!order) return;
    const exportData = buildProductionExport();
    if (!exportData) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(exportData.productionData, null, 2),
      );
      setNotice("アカウントの連絡先を除いた分析・制作用JSONをコピーしました。");
    } catch {
      setError(
        "制作用JSONをコピーできませんでした。ブラウザのクリップボード権限をご確認ください。",
      );
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
        [`${root}/order.json`]: strToU8(
          JSON.stringify(exportData.productionData, null, 2),
        ),
        [`${root}/photo-manifest.json`]: strToU8(
          JSON.stringify(exportData.manifest, null, 2),
        ),
        [`${root}/MEMORY_STORYBOOK_PRODUCTION_v2.txt`]: strToU8(
          MEMORY_STORYBOOK_PRODUCTION_PROMPT,
        ),
        [`${root}/GPT_INSTRUCTIONS.txt`]: strToU8(
          [
            "Read the top-level job, style, production_protocol, stories, and transition_rules in order.json first.",
            "Read MEMORY_STORYBOOK_PRODUCTION_v2.txt before creating any image or prompt.",
            "Follow MEMORY STORYBOOK PRODUCTION v2.0 exactly: customer photos are original-aspect-ratio references, not finished 16:9 assets.",
            "For each story, recompose a new 16:9 watercolor-and-gouache storybook page from that story's original photos and text before writing its Gen-4 motion prompt.",
            "Create one background-only 16:9 bridge page and one Gen-4 Turbo motion prompt for each item in transitions/; never add the dog to a transition page.",
            "Each folder under stories/ is one independent story and one production unit.",
            "Attach order.json and only one story folder at a time when preparing that scene.",
            "Use the file containing primary in its name as the story's composition and identity anchor.",
            "Use support files only when they clarify details; never overwrite the primary photo's visible facts.",
            "Do not mix locations, clothing, seasons, or poses between different story folders.",
            "Do not create padded, blurred, letterboxed, or cropped copies of the customer photos.",
            "Do not send a raw customer photo directly to Runway; send only the approved generated storybook page image.",
            "Return the sections listed in requested_gpt_output inside order.json.",
            "Use asset_id and archive_path when referring to each photo.",
            "",
            "FOLDER GUIDE",
            "- stories/01-title/original/: original customer photos for that story only.",
            "- Original customer photos stay in their original aspect ratio and are never padded, blurred, or cropped by this export.",
            "- Create the 16:9 storybook page image during the illustration step; that generated page, not the customer photo, is the asset sent to Runway.",
          ].join("\n"),
        ),
      };
      for (let index = 0; index < exportData.archivePhotos.length; index += 1) {
        const item = exportData.archivePhotos[index];
        setExportProgress(
          `写真を準備しています（${index + 1}/${sourceAssets.length}）`,
        );
        const { data, error: downloadError } = await supabase.storage
          .from("order-assets")
          .download(item.asset.storage_path);
        if (downloadError || !data)
          throw new Error(`${item.asset.original_filename} download failed`, {
            cause: downloadError,
          });
        files[`${root}/${item.archivePath}`] = new Uint8Array(
          await data.arrayBuffer(),
        );
      }
      setExportProgress("ZIPファイルを作成しています…");
      const archive = await new Promise<Uint8Array>((resolve, reject) => {
        zip(files, { level: 0 }, (zipError, result) => {
          if (zipError) reject(zipError);
          else resolve(result);
        });
      });
      const archiveBuffer = archive.buffer.slice(
        archive.byteOffset,
        archive.byteOffset + archive.byteLength,
      ) as ArrayBuffer;
      const archiveUrl = URL.createObjectURL(
        new Blob([archiveBuffer], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = archiveUrl;
      link.download = `${root}-GPT-production-data.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(archiveUrl), 1000);
      setNotice(
        `${memories.length}つの物語を制作フォルダに分けました。元写真${sourceAssets.length}枚と標準JSONを同梱しています。`,
      );
    } catch (bundleError) {
      console.error(bundleError);
      setError(
        "元写真の取得を完了できませんでした。通信状態を確認して、もう一度お試しください。",
      );
    } finally {
      setExportProgress("");
      setExportingBundle(false);
    }
  };

  const changePhotoAnalysisStatus = async (nextStatus: PhotoAnalysisStatus) => {
    if (!order) return false;
    setSaving(true);
    setError("");
    const { error: statusError } = await getSupabaseBrowserClient().rpc(
      "admin_set_photo_analysis_status",
      {
        p_order_id: order.id,
        p_status: nextStatus,
      },
    );
    if (statusError) {
      setError(
        "写真確認の状態を変更できませんでした。現在の状態と入力内容をご確認ください。",
      );
      setSaving(false);
      return false;
    } else {
      setNotice(
        nextStatus === "approved"
          ? "物語ごとの基準写真を承認しました。次の制作工程へ進めます。"
          : "制作素材の確認状態を更新し、操作履歴へ記録しました。",
      );
      await loadOrders();
    }
    setSaving(false);
    return true;
  };

  const makeAdminStoryPhotoPrimary = async (
    memory: OrderMemory,
    asset: OrderAsset,
  ) => {
    if (!order || !canManageStorySources || saving) return;
    setSaving(true);
    setError("");
    const { error: primaryError } = await getSupabaseBrowserClient().rpc(
      "admin_set_memory_primary_photo",
      {
        p_order_id: order.id,
        p_memory_id: memory.id,
        p_asset_id: asset.id,
      },
    );
    if (primaryError) {
      setError(
        "基準写真を変更できませんでした。写真確認の承認状態をご確認ください。",
      );
    } else {
      setNotice(`「${memory.title}」の基準写真を変更しました。`);
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  // The status only moves to needs_customer_input when the message is actually
  // sent, so the customer never sees "追加確認が必要" before the explanation.
  const prepareCustomerInputMessage = () => {
    if (!order) return;
    setMessageDraft((current) =>
      current.trim()
        ? current
        : [
            "お写真とお申し込み内容を確認しました。",
            "制作を進める前に、追加で確認させていただきたいことがあります。",
            "",
            "【確認したい内容】",
            "",
          ].join("\n"),
    );
    setCustomerInputPending(true);
    setError("");
    window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1320px)").matches) {
        document
          .getElementById("admin-message")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      messageComposerRef.current?.focus();
    });
  };

  const cancelCustomerInputRequest = () => {
    setCustomerInputPending(false);
    setNotice(
      "追加確認の連絡を取りやめました。写真確認の状態は変わっていません。",
    );
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
    if (
      (videoMode === "review" && !canUploadReview) ||
      (videoMode === "final" && !canUploadFinal)
    ) {
      setError(
        videoMode === "review"
          ? "確認映像は、映像制作または修正対応の工程で公開できます。"
          : "最終納品の前に、進行状況を『最終確認をしています』へ変更してください。",
      );
      return;
    }
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const category = videoMode === "review" ? "review_video" : "final_video";
    const folder = videoMode === "review" ? "review" : "delivery";
    const path = `${order.user_id}/${order.id}/${folder}/${category}-${crypto.randomUUID()}.${safeExtension(videoFile)}`;
    const mimeType = videoFile.type || "video/mp4";
    const { error: uploadError } = await supabase.storage
      .from("order-assets")
      .upload(path, videoFile, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setError("映像をアップロードできませんでした。");
      setSaving(false);
      return;
    }

    const { data: assetId, error: assetError } = await supabase.rpc(
      "admin_register_video_asset",
      {
        p_order_id: order.id,
        p_category: category,
        p_storage_path: path,
        p_original_filename: videoFile.name,
        p_mime_type: mimeType,
        p_file_size: videoFile.size,
      },
    );
    if (assetError || !assetId) {
      await supabase.storage.from("order-assets").remove([path]);
      setError(
        "映像情報を登録できませんでした。現在の制作工程をご確認ください。",
      );
      setSaving(false);
      return;
    }

    if (videoMode === "final") {
      const { error: deliveryError } = await supabase.rpc(
        "admin_deliver_order",
        {
          p_order_id: order.id,
          p_asset_id: assetId,
          p_title: deliveryTitle.trim() || `${order.pet_name}の動く絵本`,
          p_customer_message: deliveryMessage.trim() || null,
        },
      );
      if (deliveryError) {
        clearVideo();
        await loadDetails(order.id);
        setError(
          "映像は登録済みですが、納品処理だけ完了できませんでした。下の「登録済み映像で納品を再試行」から再利用できます。",
        );
        setSaving(false);
        return;
      }
      setNotice("完成映像と専用サイトをお客様へ納品しました。");
    } else {
      setNotice(
        "完成前の確認映像を公開しました。注文は納品済みになっていません。",
      );
    }
    clearVideo();
    await Promise.all([loadOrders(), loadDetails(order.id)]);
    setSaving(false);
  };

  const retryDelivery = async (asset: OrderAsset) => {
    if (!order || !canUploadFinal) return;
    if (
      !window.confirm(
        `${order.pet_name}ちゃんへ「${asset.original_filename}」を最終納品しますか？`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const { error: deliveryError } = await getSupabaseBrowserClient().rpc(
      "admin_deliver_order",
      {
        p_order_id: order.id,
        p_asset_id: asset.id,
        p_title: deliveryTitle.trim() || `${order.pet_name}の動く絵本`,
        p_customer_message: deliveryMessage.trim() || null,
      },
    );
    if (deliveryError)
      setError(
        "登録済み映像での納品を完了できませんでした。入金・顧客承認・未対応修正をご確認ください。",
      );
    else {
      setNotice("登録済みの完成映像を使って納品を完了しました。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const uploadSceneStill = async () => {
    if (!order || !stillFile || !canPrepareStills) return;
    const title = stillTitle.trim();
    const caption = stillCaption.trim();
    if (!title) {
      setError("場面のタイトルを入力してください。");
      return;
    }
    if (!caption) {
      setError("この場面に表示する物語の文章を入力してください。");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const extension =
      stillFile.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${order.user_id}/${order.id}/stills/scene_still-${crypto.randomUUID()}.${extension}`;
    const mimeType = stillFile.type || "image/jpeg";
    const { error: uploadError } = await supabase.storage
      .from("order-assets")
      .upload(path, stillFile, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setError("絵本ページをアップロードできませんでした。");
      setSaving(false);
      return;
    }
    const { data: stillAssetId, error: registerError } = await supabase.rpc(
      "admin_register_scene_still",
      {
        p_order_id: order.id,
        p_storage_path: path,
        p_original_filename: stillFile.name,
        p_mime_type: mimeType,
        p_file_size: stillFile.size,
        p_scene_title: title,
        p_scene_sort_order: sceneStills.length,
      },
    );
    if (registerError || !stillAssetId) {
      await supabase.storage.from("order-assets").remove([path]);
      setError(
        "絵本ページを登録できませんでした。入金・同意・現在の工程をご確認ください。",
      );
      setSaving(false);
      return;
    }
    const { error: captionError } = await supabase.rpc(
      "admin_update_scene_caption",
      {
        p_asset_id: stillAssetId as string,
        p_story_caption: caption,
      },
    );
    if (captionError) {
      await supabase.rpc("admin_delete_scene_still", {
        p_asset_id: stillAssetId as string,
      });
      await supabase.storage.from("order-assets").remove([path]);
      setError("物語の文章を保存できませんでした。もう一度お試しください。");
      setSaving(false);
      return;
    }
    setStillFile(null);
    setStillTitle("");
    setStillCaption("");
    setStillInputKey((current) => current + 1);
    setNotice(
      "絵本ページと文章を追加しました。公開ボタンを押すまでお客様には表示されません。",
    );
    await loadDetails(order.id);
    setSaving(false);
  };

  const saveSceneCaption = async (asset: OrderAsset) => {
    if (!canPrepareStills) return;
    const caption = (captionDrafts[asset.id] ?? "").trim();
    if (!caption) {
      setError("物語の文章を入力してください。");
      return;
    }
    setSaving(true);
    setError("");
    const { error: captionError } = await getSupabaseBrowserClient().rpc(
      "admin_update_scene_caption",
      { p_asset_id: asset.id, p_story_caption: caption },
    );
    if (captionError) setError("物語の文章を保存できませんでした。");
    else {
      setNotice("物語の文章を保存しました。");
      await loadDetails(asset.order_id);
    }
    setSaving(false);
  };

  const deleteSceneStill = async (asset: OrderAsset) => {
    if (!order || !canPrepareStills) return;
    if (
      !window.confirm(
        `「${asset.scene_title ?? asset.original_filename}」を削除しますか？`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { data: storagePath, error: deleteError } = await supabase.rpc(
      "admin_delete_scene_still",
      { p_asset_id: asset.id },
    );
    if (deleteError) {
      setError("絵本ページを削除できませんでした。");
    } else {
      if (storagePath)
        await supabase.storage
          .from("order-assets")
          .remove([storagePath as string]);
      setNotice("絵本ページを削除しました。");
      await loadDetails(order.id);
    }
    setSaving(false);
  };

  const publishSceneStills = async () => {
    if (!order || !canPrepareStills || sceneStills.length === 0) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { error: publishError } = await supabase.rpc(
      "admin_publish_scene_stills",
      { p_order_id: order.id },
    );
    if (publishError) {
      setError(
        "絵本ページを公開できませんでした。すべてのページに物語文があるか、入金・同意・現在の工程をご確認ください。",
      );
      setSaving(false);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        orderId: order.id,
        body: "絵本ページと物語の文章を公開しました。制作室で全ページをご確認のうえ、この内容で動画制作へ進めてよいかお知らせください。",
      }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as {
          saved?: boolean;
          notificationSent?: boolean;
        } | null)
      : null;
    setNotice(
      result?.notificationSent
        ? "絵本ページをお客様へ公開し、メールでお知らせしました。"
        : "絵本ページを公開しました。メール通知は送れなかったため、必要ならメッセージでお知らせください。",
    );
    await Promise.all([loadOrders(), loadDetails(order.id)]);
    setSaving(false);
  };

  const beginStillsRevision = async () => {
    if (!order || order.status !== "stills_review" || !order.stills_change_open)
      return;
    setSaving(true);
    setError("");
    const { error: revisionError } = await getSupabaseBrowserClient().rpc(
      "admin_begin_stills_revision",
      { p_order_id: order.id },
    );
    if (revisionError)
      setError(
        "絵本ページの調整を開始できませんでした。現在の工程をご確認ください。",
      );
    else {
      setNotice(
        "絵本ページの調整を開始しました。差し替え後に、もう一度公開してください。",
      );
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const uploadRenderClip = async (still: OrderAsset, file: File) => {
    if (!order || !canRenderFilm) return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "mp4";
    // Operator namespace, never the customer's uid folder — see the note at the
    // top of supabase/migrations/202607280001_render_clips.sql.
    const path = `admin/${order.id}/clips/render_clip-${crypto.randomUUID()}.${extension}`;
    const mimeType = file.type || "video/mp4";
    const { error: uploadError } = await supabase.storage
      .from("order-assets")
      .upload(path, file, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setError("クリップをアップロードできませんでした。");
      setSaving(false);
      return;
    }
    const { error: registerError } = await supabase.rpc(
      "admin_register_render_clip",
      {
        p_order_id: order.id,
        p_storage_path: path,
        p_original_filename: file.name,
        p_mime_type: mimeType,
        p_file_size: file.size,
        p_still_asset_id: still.id,
      },
    );
    if (registerError) {
      await supabase.storage.from("order-assets").remove([path]);
      setError(
        "クリップを登録できませんでした。お客様が承認した絵本ページかどうかご確認ください。",
      );
      setSaving(false);
      return;
    }
    setClipInputKey((current) => current + 1);
    setNotice(`「${still.scene_title ?? "場面"}」のクリップを追加しました。`);
    await loadDetails(order.id);
    setSaving(false);
  };

  const deleteRenderClip = async (asset: OrderAsset) => {
    if (!order || !canRenderFilm) return;
    if (
      !window.confirm(
        `「${asset.scene_title ?? asset.original_filename}」のクリップを削除しますか？`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const { data: storagePath, error: deleteError } = await supabase.rpc(
      "admin_delete_render_clip",
      { p_asset_id: asset.id },
    );
    if (deleteError) {
      setError("クリップを削除できませんでした。");
    } else {
      if (storagePath)
        await supabase.storage
          .from("order-assets")
          .remove([storagePath as string]);
      setNotice("クリップを削除しました。");
      await loadDetails(order.id);
    }
    setSaving(false);
  };

  const startRender = async () => {
    if (!order || !canRenderFilm || rendering) return;
    if (renderClips.length < 3) {
      setError("編集にはクリップが3本以上必要です。");
      return;
    }
    if (!filmTitle.trim()) {
      setError("映像のタイトルを入力してください。");
      return;
    }
    if (!filmEndingText.trim()) {
      setError("エンディングの文章を入力してください。");
      return;
    }

    setRendering(true);
    setError("");
    setRenderProgress("編集を準備しています…");
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const items = renderClips.map((clip, index) => ({
      clipAssetId: clip.id,
      role:
        index === 0
          ? "intro"
          : index === renderClips.length - 1
            ? "ending"
            : "memory",
    }));

    try {
      const response = await fetch("/api/admin/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          items,
          title: filmTitle.trim(),
          kicker: filmKicker.trim(),
          endingText: filmEndingText.trim(),
          endingMark: filmEndingMark.trim(),
          bgmFile: filmBgm || null,
          letterboxPct: filmLetterbox ? filmLetterboxPct : 0,
          filmLook,
        }),
      });

      if (!response.ok || !response.body) {
        const detail = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(detail?.message ?? "編集を開始できませんでした。");
        setRenderProgress("");
        setRendering(false);
        return;
      }

      // The route streams newline-delimited JSON so the operator sees real
      // progress instead of a frozen button for several minutes.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RenderProgressEvent;
          if (event.type === "progress") setRenderProgress(event.message);
          else if (event.type === "done") {
            setRenderProgress("");
            setNotice(
              `編集が完了しました（約${Math.round(event.durationSeconds)}秒 · ${(event.fileSize / 1024 / 1024).toFixed(1)} MB）。内容を確認してから公開してください。`,
            );
          } else if (event.type === "error") {
            failed = true;
            setError(event.message);
            setRenderProgress("");
          }
        }
      }
      if (!failed) await loadDetails(order.id);
    } catch {
      setError("編集中に接続が切れました。もう一度お試しください。");
      setRenderProgress("");
    }
    setRendering(false);
  };

  const promoteAssembledFilm = async (asset: OrderAsset) => {
    if (!order || !canUploadReview) return;
    if (
      !window.confirm(
        `${order.pet_name}ちゃんの確認映像としてお客様に公開します。よろしいですか？`,
      )
    )
      return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const previousPath = asset.storage_path;
    const newPath = `${order.user_id}/${order.id}/review/review_video-${crypto.randomUUID()}.mp4`;
    // Must physically leave the admin namespace before the customer can read it.
    const { error: moveError } = await supabase.storage
      .from("order-assets")
      .move(previousPath, newPath);
    if (moveError) {
      setError("映像を公開用の場所へ移動できませんでした。");
      setSaving(false);
      return;
    }
    const { error: promoteError } = await supabase.rpc(
      "admin_promote_assembled_film",
      {
        p_asset_id: asset.id,
        p_storage_path: newPath,
      },
    );
    if (promoteError) {
      await supabase.storage.from("order-assets").move(newPath, previousPath);
      setError(
        "確認映像として公開できませんでした。入金・同意・現在の工程をご確認ください。",
      );
      setSaving(false);
      return;
    }
    setNotice("確認映像としてお客様へ公開しました。");
    await Promise.all([loadOrders(), loadDetails(order.id)]);
    setSaving(false);
  };

  const resolveMessage = async (messageId: string) => {
    if (!order) return;
    setSaving(true);
    const { error: resolveError } = await getSupabaseBrowserClient().rpc(
      "admin_resolve_message",
      { p_message_id: messageId },
    );
    if (resolveError) setError("メッセージを対応済みにできませんでした。");
    else {
      setNotice("メッセージを対応済みにしました。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const resolveRevision = async (revisionId: string) => {
    if (!order) return;
    setSaving(true);
    const { error: resolveError } = await getSupabaseBrowserClient().rpc(
      "admin_resolve_revision",
      { p_revision_id: revisionId },
    );
    if (resolveError)
      setError(
        resolveError.message.includes("revised review video")
          ? "先に修正版を『完成前の確認映像』として公開してください。"
          : "修正依頼を対応済みにできませんでした。",
      );
    else {
      setNotice("修正依頼を対応済みにし、履歴へ記録しました。");
      await Promise.all([loadOrders(), loadDetails(order.id)]);
    }
    setSaving(false);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order) return;
    const body = messageDraft.trim();
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
    const result = (await response.json().catch(() => null)) as {
      saved?: boolean;
      notificationSent?: boolean;
      error?: string;
      notificationReason?: string | null;
    } | null;
    if (!response.ok || !result?.saved) {
      setError(
        result?.error === "server_not_configured"
          ? "メッセージ機能の接続設定を確認できませんでした。VercelのSupabase環境変数をご確認ください。"
          : "メッセージを送信できませんでした。時間をおいてもう一度お試しください。",
      );
    } else {
      setMessageDraft("");
      const notifyNote = result.notificationSent
        ? "お客様へメッセージを送り、メールでお知らせしました。"
        : "メッセージは保存しましたが、メール通知を送れませんでした。Resendの設定・送信履歴をご確認ください。";
      if (customerInputPending) {
        const { error: statusError } = await supabase.rpc(
          "admin_set_photo_analysis_status",
          {
            p_order_id: order.id,
            p_status: "needs_customer_input",
          },
        );
        if (statusError) {
          setError(
            "メッセージは送信しましたが、写真確認の状態を「お客様へ追加確認が必要」へ変更できませんでした。現在の状態をご確認ください。",
          );
        } else {
          setNotice(
            `${notifyNote}あわせて写真確認の状態を「お客様へ追加確認が必要」へ変更しました。`,
          );
        }
        setCustomerInputPending(false);
        await loadOrders();
      } else {
        setNotice(notifyNote);
      }
      await loadDetails(order.id);
    }
    setSaving(false);
  };

  if (authLoading || loading)
    return <div className="wizard-loading">運営画面を準備しています…</div>;
  if (!user || profile?.role !== "admin")
    return (
      <main className="admin-denied">
        <p className="eyebrow">ADMIN ONLY</p>
        <h1>管理者権限が必要です。</h1>
        <p>管理者として登録されたアカウントでログインしてください。</p>
        <Link className="button button-primary" href="/studio">
          制作室へ戻る
        </Link>
      </main>
    );

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="brand" href="/">
          <span className="brand-mark">WM</span>
          <span className="brand-type">
            WAN MEMORY<small>PRODUCTION ADMIN</small>
          </span>
        </Link>
        <nav>
          <Link href="/studio">顧客制作室</Link>
          <span>{profile.full_name || profile.email}</span>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            ログアウト
          </button>
        </nav>
      </header>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <p className="eyebrow">ORDERS</p>
          <h1>制作管理</h1>
          {totalAttention > 0 && (
            <button
              type="button"
              className="admin-sidebar-total"
              onClick={() => changeFilter("attention")}
            >
              <strong>{totalAttention}件</strong>
              <span>対応が必要な連絡・修正</span>
            </button>
          )}
          <select
            aria-label="注文の状態で絞り込む"
            value={filter}
            onChange={(event) => changeFilter(event.target.value)}
          >
            <option value="all">すべての注文</option>
            <option value="attention">未対応あり（{totalAttention}件）</option>
            {statusOptions.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="admin-mobile-order-picker">
            <span>対応する注文</span>
            <select
              value={selectedOrderId}
              onChange={(event) => selectOrder(event.target.value)}
            >
              {visibleOrders.map((item) => {
                const attention = attentionByOrder[item.id];
                const count =
                  (attention?.messages ?? 0) + (attention?.revisions ?? 0);
                return (
                  <option value={item.id} key={item.id}>
                    {count ? `● ${count}件 · ` : ""}
                    {item.pet_name} · {ORDER_STATUS_LABELS[item.status]}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="admin-order-list">
            {visibleOrders.map((item) => {
              const attention = attentionByOrder[item.id];
              const count =
                (attention?.messages ?? 0) + (attention?.revisions ?? 0);
              return (
                <button
                  type="button"
                  className={item.id === selectedOrderId ? "active" : ""}
                  onClick={() => selectOrder(item.id)}
                  key={item.id}
                >
                  <span>
                    {ORDER_STATUS_LABELS[item.status]}
                    {count > 0 && (
                      <b className="admin-order-alert">未対応 {count}</b>
                    )}
                  </span>
                  <strong>{item.pet_name}</strong>
                  <small>
                    {item.order_number} · ¥
                    {new Intl.NumberFormat("ja-JP").format(item.quoted_price)}
                    （税込）
                  </small>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="admin-main">
          {notice && (
            <p className="studio-alert" role="status">
              {notice}
              <button type="button" onClick={() => setNotice("")}>
                ×
              </button>
            </p>
          )}
          {error && (
            <p className="studio-alert error" role="alert">
              {error}
              <button type="button" onClick={() => setError("")}>
                ×
              </button>
            </p>
          )}

          <details className="admin-security" id="admin-security">
            <summary>
              <span className="eyebrow">ACCOUNT SECURITY</span>
              <strong>アカウントの保護と操作ログ</strong>
              <span
                className={
                  mfaFactors.length
                    ? "admin-security-badge on"
                    : "admin-security-badge"
                }
              >
                {mfaFactors.length ? "二段階認証 有効" : "二段階認証 未設定"}
              </span>
            </summary>

            <div className="admin-security-body">
              <section>
                <h4>二段階認証（TOTP）</h4>
                {mfaFactors.length > 0 ? (
                  <>
                    <p className="admin-operation-note">
                      この管理アカウントは認証アプリで保護されています。
                    </p>
                    <ul className="admin-security-factors">
                      {mfaFactors.map((factor) => (
                        <li key={factor.id}>
                          <span>
                            {factor.friendly_name || "認証アプリ"}（
                            {factor.status === "verified" ? "有効" : "未確認"}）
                          </span>
                          <button
                            className="button button-outline"
                            type="button"
                            disabled={saving}
                            onClick={() => removeMfaFactor(factor.id)}
                          >
                            解除する
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : mfaEnrollment ? (
                  <>
                    <p className="admin-operation-note strong">
                      認証アプリ（Google Authenticator など）でこの QR
                      コードを読み取り、表示された 6
                      桁のコードを入力してください。
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="admin-security-qr"
                      src={mfaEnrollment.qr}
                      alt="二段階認証の QR コード"
                    />
                    <p className="admin-security-secret">
                      QR を読み取れない場合の設定キー：
                      <code>{mfaEnrollment.secret}</code>
                    </p>
                    <div className="admin-form-grid">
                      <label>
                        <span>認証コード</span>
                        <input
                          value={mfaCode}
                          onChange={(event) =>
                            setMfaCode(
                              event.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          inputMode="numeric"
                          placeholder="000000"
                          maxLength={6}
                        />
                      </label>
                    </div>
                    <div className="admin-still-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={saving || mfaCode.length !== 6}
                        onClick={confirmMfaEnrollment}
                      >
                        登録を完了する →
                      </button>
                      <button
                        className="button button-outline"
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setMfaEnrollment(null);
                          setMfaCode("");
                        }}
                      >
                        やめる
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="admin-operation-note warning">
                      二段階認証が未設定です。管理画面はお客様の個人情報を扱うため、有効化を強くおすすめします。
                    </p>
                    <div className="admin-still-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={saving}
                        onClick={startMfaEnrollment}
                      >
                        二段階認証を設定する →
                      </button>
                    </div>
                  </>
                )}
              </section>

              <section>
                <h4>操作ログ（直近100件）</h4>
                {securityEvents.length === 0 ? (
                  <p className="admin-empty-copy">
                    記録された操作はまだありません。
                  </p>
                ) : (
                  <div className="admin-security-log">
                    {securityEvents.map((event) => (
                      <article key={event.id}>
                        <span>
                          {SECURITY_EVENT_LABELS[event.event_type] ??
                            event.event_type}
                        </span>
                        <small>{formatDateTime(event.created_at)}</small>
                      </article>
                    ))}
                  </div>
                )}
                <p className="admin-operation-note">
                  ログイン成功・失敗、アカウントロック、権限変更を記録しています。10
                  回連続で失敗したアカウントは 30 分間ロックされます。
                </p>
              </section>
            </div>
          </details>

          {!order ? (
            <div className="admin-empty">
              <h2>注文はまだありません。</h2>
              <p>新しい相談が入るとこちらに表示されます。</p>
            </div>
          ) : (
            <>
              <div className="admin-title">
                <div>
                  <p className="eyebrow">{order.order_number}</p>
                  <h2>{order.pet_name}ちゃんの動く絵本</h2>
                  <span>
                    {customer?.full_name || customer?.email || order.user_id}
                  </span>
                </div>
                <Link
                  className="button button-outline"
                  href={`/studio?order=${order.id}&preview=1`}
                  target="_blank"
                  rel="noreferrer"
                >
                  顧客画面を閲覧
                </Link>
              </div>

              <div className="admin-workspace">
                <div className="admin-content">
                  <section
                    className="admin-card admin-photo-analysis"
                    id="admin-photo-analysis"
                  >
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">STORY SOURCE REVIEW</p>
                        <h3>物語ごとの制作素材チェック</h3>
                      </div>
                      <span
                        className={`photo-analysis-status ${productionFields.photoAnalysisStatus}`}
                      >
                        {photoAnalysisStatusLabel(
                          productionFields.photoAnalysisStatus,
                        )}
                      </span>
                    </div>
                    <div className="admin-reference-photo-grid">
                      {memories.map((memory) => {
                        const storyPhotos = sourceAssets
                          .filter((asset) => asset.memory_id === memory.id)
                          .sort(
                            (a, b) =>
                              (a.memory_photo_sort_order ?? 99) -
                              (b.memory_photo_sort_order ?? 99),
                          );
                        const primaryPhoto = storyPhotos[0] ?? null;
                        return (
                          <article key={memory.id}>
                            <strong>
                              STORY {String(memory.sort_order).padStart(2, "0")}
                            </strong>
                            {primaryPhoto && assetUrls[primaryPhoto.id] ? (
                              <a
                                href={assetUrls[primaryPhoto.id]}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span
                                  className="admin-photo-thumb"
                                  role="img"
                                  aria-label={`${memory.title}の基準写真`}
                                  style={{
                                    backgroundImage: `url(${assetUrls[primaryPhoto.id]})`,
                                  }}
                                />
                              </a>
                            ) : (
                              <span className="admin-reference-empty">
                                基準写真なし
                              </span>
                            )}
                            <small>
                              {memory.title} · 基準1枚 + 補助
                              {Math.max(0, storyPhotos.length - 1)}枚
                            </small>
                          </article>
                        );
                      })}
                    </div>
                    <dl className="admin-story">
                      <div>
                        <dt>制作単位</dt>
                        <dd>{memories.length}物語 · 物語ごとにRunway 1クリップ</dd>
                      </div>
                      <div>
                        <dt>写真の使い方</dt>
                        <dd>各物語の1枚目を基準にし、2〜3枚目は補助だけに使用</dd>
                      </div>
                      <div>
                        <dt>映像としての再構成の確認</dt>
                        <dd>
                          {productionFields.aiReconstructionAcknowledged
                            ? "確認済み"
                            : "未確認"}
                        </dd>
                      </div>
                      <div>
                        <dt>承認日時</dt>
                        <dd>
                          {formatDateTime(
                            productionFields.photoAnalysisApprovedAt,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>承認した運営者</dt>
                        <dd>
                          {productionFields.photoAnalysisApprovedBy
                            ? productionFields.photoAnalysisApprovedBy ===
                              user.id
                              ? profile?.email || user.id
                              : productionFields.photoAnalysisApprovedBy
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="admin-photo-analysis-actions">
                      {productionFields.photoAnalysisStatus ===
                        "pending_operator_review" && (
                        <>
                          <button
                            className="button button-primary"
                            type="button"
                            disabled={saving || customerInputPending}
                            onClick={() =>
                              changePhotoAnalysisStatus("approved")
                            }
                          >
                            物語と写真を承認する →
                          </button>
                          <button
                            className="button button-outline"
                            type="button"
                            disabled={saving || customerInputPending}
                            onClick={prepareCustomerInputMessage}
                          >
                            お客様への確認が必要・連絡する
                          </button>
                        </>
                      )}
                      {productionFields.photoAnalysisStatus ===
                        "needs_customer_input" && (
                        <button
                          className="button button-outline"
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            changePhotoAnalysisStatus("pending_operator_review")
                          }
                        >
                          追加内容を確認待ちに戻す
                        </button>
                      )}
                      {productionFields.photoAnalysisStatus === "approved" && (
                        <button
                          className="button button-outline"
                          type="button"
                          disabled={saving || customerInputPending}
                          onClick={prepareCustomerInputMessage}
                        >
                          承認を取り消し、追加確認を連絡する
                        </button>
                      )}
                    </div>
                    {customerInputPending && (
                      <aside className="admin-operation-note strong">
                        <strong>まだ状態は変更していません。</strong>
                        <span>
                          右の「お客様との連絡」で確認したい内容を書き、メッセージを送信すると、そのタイミングで写真確認の状態を「お客様へ追加確認が必要」へ変更します。
                        </span>
                      </aside>
                    )}
                    {!photoAnalysisApproved && (
                      <aside className="admin-operation-note warning">
                        <strong>次の制作工程は停止中です。</strong>
                        <span>
                          すべての物語に基準写真があることを確認し、承認すると次の制作工程へ進めます。
                        </span>
                      </aside>
                    )}
                  </section>

                  <aside
                    className="admin-attention-summary"
                    aria-label="未対応項目"
                  >
                    <div>
                      <strong>{sourceAssets.length}</strong>
                      <span>お預かり写真</span>
                    </div>
                    <div className={openMessages.length ? "needs-action" : ""}>
                      <strong>{openMessages.length}</strong>
                      <span>未対応メッセージ</span>
                    </div>
                    <div className={openRevisions.length ? "needs-action" : ""}>
                      <strong>{openRevisions.length}</strong>
                      <span>未対応の修正</span>
                    </div>
                    <div>
                      <strong>
                        {order.revision_used}/{order.revision_limit}
                      </strong>
                      <span>使用済み修正回数</span>
                    </div>
                  </aside>

                  <nav className="admin-mobile-sections" aria-label="管理項目">
                    <a href="#admin-progress">進行</a>
                    <a href="#admin-story">内容</a>
                    <a href="#admin-photos">写真</a>
                    <a href="#admin-concepts">2案</a>
                    <a href="#admin-stills">場面</a>
                    <a href="#admin-render">編集</a>
                    <a href="#admin-revisions">修正</a>
                    <a href="#admin-video">映像</a>
                    <a href="#admin-message">連絡</a>
                  </nav>

                  <section className="admin-card" id="admin-progress">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">PRODUCTION STATUS</p>
                        <h3>進行状況・入金・納期</h3>
                      </div>
                      <span>許可された次の工程だけを表示</span>
                    </div>
                    {order.payment_status === "pending" &&
                      !["delivered", "cancelled"].includes(order.status) && (
                        <aside className="admin-operation-note warning">
                          <strong>お支払いはまだご案内していません。</strong>
                          <span>
                            お客様が構成案を選び、現在版の同意記録が揃ったら、入金状態を「お支払いをご案内」にして保存してください。
                          </span>
                        </aside>
                      )}
                    {order.payment_status === "invoice_sent" && (
                      <aside className="admin-operation-note strong">
                        <strong>カード決済待ちです。</strong>
                        <span>
                          お客様の制作室に決済ボタンが表示されています。入金完了は自動で反映されます。
                        </span>
                      </aside>
                    )}
                    {order.payment_status === "paid" && (
                      <aside className="admin-operation-note strong">
                        <strong>お支払いを確認しました。</strong>
                        <span>
                          管理画面から手動変更せず、制作工程へ進めてください。
                        </span>
                      </aside>
                    )}
                    {order.payment_status === "refunded" && (
                      <aside className="admin-operation-note warning">
                        <strong>返金済みです。</strong>
                        <span>返金状態は自動で反映されています。</span>
                      </aside>
                    )}
                    {!consentCurrent &&
                      !["delivered", "cancelled"].includes(order.status) && (
                        <aside className="admin-operation-note warning">
                          <strong>現在版の同意記録が揃っていません。</strong>
                          <span>
                            お客様が制作室で利用規約・写真使用権限（人物の了解を含む）・外部制作サービスでの処理を確認するまで制作を開始できません。
                          </span>
                        </aside>
                      )}
                    {order.customer_approved_at && (
                      <aside className="admin-operation-note strong">
                        <strong>お客様が確認映像を確定済みです。</strong>
                        <span>
                          {formatDateTime(order.customer_approved_at)} ·
                          承認した確認映像ID{" "}
                          {order.customer_approved_review_asset_id}
                        </span>
                      </aside>
                    )}
                    <div className="admin-form-grid">
                      <label>
                        <span>現在の状態</span>
                        <select
                          value={status}
                          onChange={(event) =>
                            setStatus(event.target.value as OrderStatus)
                          }
                        >
                          {selectableStatuses.map(([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>入金状態</span>
                        <select
                          value={paymentStatus}
                          disabled={
                            order.payment_status === "paid" ||
                            order.payment_status === "refunded"
                          }
                          onChange={(event) =>
                            setPaymentStatus(
                              event.target
                                .value as MemoryOrder["payment_status"],
                            )
                          }
                        >
                          <option value="pending">ご案内前</option>
                          <option
                            value="invoice_sent"
                            disabled={
                              (!APPLICATIONS_OPEN || !canRequestPayment) &&
                              order.payment_status !== "invoice_sent"
                            }
                          >
                            お支払いをご案内
                          </option>
                          {order.payment_status === "paid" && (
                            <option value="paid">入金確認済み</option>
                          )}
                          {order.payment_status === "refunded" && (
                            <option value="refunded">返金済み</option>
                          )}
                        </select>
                        <small>
                          {!APPLICATIONS_OPEN
                            ? "現在、お支払い受付は準備中です。"
                            : order.payment_status === "pending" &&
                                !canRequestPayment
                              ? "構成案の選択と現在版の同意記録が揃うとご案内できます。"
                              : "入金・返金は決済結果から自動反映されます。"}
                        </small>
                      </label>
                      <label>
                        <span>予定完成日</span>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(event) => setDueDate(event.target.value)}
                        />
                      </label>
                      <label className="wide">
                        <span>運営メモ（顧客には非表示）</span>
                        <textarea
                          rows={3}
                          value={adminNotes}
                          onChange={(event) =>
                            setAdminNotes(event.target.value)
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={
                        saving ||
                        (!APPLICATIONS_OPEN &&
                          paymentStatus === "invoice_sent" &&
                          order.payment_status !== "invoice_sent") ||
                        (paymentStatus === "invoice_sent" &&
                          !canRequestPayment &&
                          order.payment_status !== "invoice_sent")
                      }
                      onClick={saveOrder}
                    >
                      {saving
                        ? "保存中…"
                        : !APPLICATIONS_OPEN &&
                            paymentStatus === "invoice_sent" &&
                            order.payment_status !== "invoice_sent"
                          ? "お支払い受付は準備中"
                          : paymentStatus === "invoice_sent" &&
                              order.payment_status !== "invoice_sent"
                            ? "お支払い案内を送る →"
                            : "進行状況を保存"}
                    </button>
                  </section>

                  <section className="admin-card" id="admin-story">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">CUSTOMER STORY</p>
                        <h3>物語別 Runway 制作セット</h3>
                      </div>
                      <div className="admin-export-actions">
                        <button
                          className="button button-outline admin-json-copy"
                          type="button"
                          disabled={
                            saving ||
                            exportingBundle ||
                            sourceAssets.length === 0
                          }
                          onClick={copyProductionJson}
                        >
                          JSONだけコピー
                        </button>
                        <button
                          className="button button-primary admin-bundle-download"
                          type="button"
                          disabled={
                            saving ||
                            exportingBundle ||
                            sourceAssets.length === 0
                          }
                          onClick={downloadProductionBundle}
                        >
                          {exportingBundle
                            ? "準備中…"
                            : "物語別の制作用データをダウンロード"}
                        </button>
                      </div>
                    </div>
                    {exportProgress && (
                      <p className="admin-export-progress" role="status">
                        <span aria-hidden="true" />
                        {exportProgress}
                      </p>
                    )}
                    <aside className="admin-operation-note strong">
                      <strong>標準JSONと物語別フォルダを一緒に作ります。</strong>
                      <span>
                        ダウンロードしたorder.jsonをそのまま「MEMORY STORYBOOK PRODUCTION v2.0」の制作依頼に添付できます。5つの物語、4つのTurbo接続ページ、写真の対応関係、固定スタイルを同じJSONで確認できます。顧客写真は原寸比率のまま保管し、16:9化は絵本ページ生成時に行います。
                      </span>
                    </aside>
                    <dl className="admin-story">
                      <div>
                        <dt>映像の目的</dt>
                        <dd>{order.purpose}</dd>
                      </div>
                      <div>
                        <dt>犬種・年齢</dt>
                        <dd>
                          {order.breed} · {order.age_text || "未入力"}
                        </dd>
                      </div>
                      <div>
                        <dt>性格</dt>
                        <dd>{order.personality.join("、") || "未入力"}</dd>
                      </div>
                      <div>
                          <dt>物語の数</dt>
                        <dd>
                          {memories.length
                            ? `${memories.length}件`
                            : "旧形式の受付"}
                        </dd>
                      </div>
                      {memories.length === 0 && (
                        <>
                          <div>
                            <dt>はじめて会った日</dt>
                            <dd>{order.first_meeting || "未入力"}</dd>
                          </div>
                          <div>
                            <dt>いちばんの思い出</dt>
                            <dd>{order.favorite_memory || "未入力"}</dd>
                          </div>
                        </>
                      )}
                      <div>
                        <dt>伝えたい言葉</dt>
                        <dd>{order.message_to_pet || "未入力"}</dd>
                      </div>
                      {order.avoid_notes && (
                        <div>
                          <dt>入れたくないこと（旧形式）</dt>
                          <dd>{order.avoid_notes}</dd>
                        </div>
                      )}
                      <div>
                        <dt>人物写真の取り扱い</dt>
                        <dd>
                          {order.contains_people === null
                            ? "固定ポリシー：お顔は使用せず、後ろ姿などのみ"
                            : `旧形式の記録：${order.contains_people ? "人物あり" : "人物なし"} · ${peopleHandlingLabel(order.people_handling)} · 未成年者${order.contains_minors ? "あり" : "なし"}`}
                        </dd>
                      </div>
                      <div>
                        <dt>規約・Privacy同意</dt>
                        <dd>
                          {order.consented_at
                            ? `${formatDateTime(order.consented_at)} · 規約 ${order.terms_version} / Privacy ${order.privacy_version}`
                            : "同意記録なし"}
                        </dd>
                      </div>
                      <div>
                        <dt>写真使用権限・人物の了解</dt>
                        <dd>
                          {order.photo_rights_consented_at
                            ? `${formatDateTime(order.photo_rights_consented_at)} · ${order.photo_rights_consent_version}`
                            : "同意記録なし"}
                        </dd>
                      </div>
                      <div>
                        <dt>外部AI処理同意</dt>
                        <dd>
                          {order.external_ai_consent_at
                            ? `${formatDateTime(order.external_ai_consent_at)} · Notice ${order.ai_notice_version}`
                            : "同意記録なし"}
                        </dd>
                      </div>
                    </dl>
                    {memories.length > 0 && (
                      <div className="admin-memory-list">
                        {memories.map((memory) => {
                          const memoryPhotos = sourceAssets
                            .filter((asset) => asset.memory_id === memory.id)
                            .sort(
                              (a, b) =>
                                (a.memory_photo_sort_order ?? 99) -
                                (b.memory_photo_sort_order ?? 99),
                            );
                          return (
                            <article key={memory.id}>
                              <header>
                                <span>
                                  MEMORY{" "}
                                  {String(memory.sort_order).padStart(2, "0")}
                                </span>
                                <strong>{memory.title}</strong>
                                <small>{memoryPhotos.length}枚</small>
                              </header>
                              <dl>
                                <div>
                                  <dt>時期</dt>
                                  <dd>{memory.when_text || "指定なし"}</dd>
                                </div>
                                <div>
                                  <dt>場所</dt>
                                  <dd>{memory.location || "指定なし"}</dd>
                                </div>
                                <div>
                                  <dt>詳しい内容</dt>
                                  <dd>{memory.description}</dd>
                                </div>
                                {memory.dog_behavior && (
                                  <div>
                                    <dt>表情・動き（旧形式）</dt>
                                    <dd>{memory.dog_behavior}</dd>
                                  </div>
                                )}
                              </dl>
                              <div className="admin-memory-photos">
                                {memoryPhotos.map((asset) => (
                                  <article
                                    className={
                                      asset.memory_photo_sort_order === 1
                                        ? "primary"
                                        : ""
                                    }
                                    key={asset.id}
                                  >
                                    <a
                                      href={assetUrls[asset.id]}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {assetUrls[asset.id] ? (
                                        <span
                                          className="admin-photo-thumb"
                                          role="img"
                                          aria-label={`${memory.title}の写真`}
                                          style={{
                                            backgroundImage: `url(${assetUrls[asset.id]})`,
                                          }}
                                        />
                                      ) : (
                                        <span>読み込み中</span>
                                      )}
                                      <small>
                                        {asset.memory_photo_sort_order === 1
                                          ? "基準写真"
                                          : `補助写真 ${(asset.memory_photo_sort_order ?? 2) - 1}`} · {asset.original_filename}
                                      </small>
                                    </a>
                                    {canManageStorySources &&
                                      asset.memory_photo_sort_order !== 1 && (
                                        <button
                                          type="button"
                                          disabled={saving}
                                          onClick={() =>
                                            void makeAdminStoryPhotoPrimary(
                                              memory,
                                              asset,
                                            )
                                          }
                                        >
                                          基準写真に変更
                                        </button>
                                      )}
                                  </article>
                                ))}
                              </div>
                              <p className="admin-memory-check">
                                1枚目だけでこの物語の構図・季節・場所が分かるか確認します。補助写真は不足する特徴だけを見るために使います。
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="admin-card" id="admin-photos">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">CUSTOMER PHOTOS</p>
                        <h3>写真一覧</h3>
                      </div>
                      <span>{sourceAssets.length}枚</span>
                    </div>
                    {sourceAssets.length ? (
                      <>
                        <div className="admin-photo-grid">
                          {sourceAssets.map((asset) => (
                            <a
                              href={assetUrls[asset.id]}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`${asset.original_filename}を大きく表示`}
                              key={asset.id}
                            >
                              {assetUrls[asset.id] ? (
                                <span
                                  className="admin-photo-thumb"
                                  role="img"
                                  aria-label={`${order.pet_name}ちゃんの提出写真`}
                                  style={{
                                    backgroundImage: `url(${assetUrls[asset.id]})`,
                                  }}
                                />
                              ) : (
                                <span>読み込み中</span>
                              )}
                              <small>
                                {asset.original_filename}
                                {asset.memory_id
                                  ? " · 思い出に紐付け済み"
                                  : " · 追加写真"}
                              </small>
                            </a>
                          ))}
                        </div>
                        <p className="admin-operation-note">
                          すべての写真は物語に紐づいています。追加をお願いするのは、その物語の制作に本当に必要な情報が足りない場合だけです。
                        </p>
                      </>
                    ) : (
                      <p className="admin-empty-copy">
                        写真はまだ登録されていません。各物語に最低1枚の場面写真が必要です。
                      </p>
                    )}
                  </section>

                  <section className="admin-card" id="admin-concepts">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">STORY DIRECTION DELIVERY</p>
                        <h3>物語案2案</h3>
                      </div>
                      <span>{concepts.length}/2 保存済み</span>
                    </div>
                    {order.selected_concept_slot ? (
                      <aside className="admin-operation-note strong">
                        <strong>
                          お客様が構成案 {order.selected_concept_slot}
                          を選択しました。
                        </strong>
                        <span>
                          {concepts.find(
                            (concept) =>
                              concept.slot === order.selected_concept_slot,
                          )?.title ?? ""}
                        </span>
                      </aside>
                    ) : (
                      concepts.length === 2 && (
                        <aside className="admin-operation-note">
                          まだお客様の選択待ちです。選択されるとここに表示されます。
                        </aside>
                      )
                    )}
                    {order.status === "materials_submitted" &&
                      photoAnalysisApproved && (
                        <aside className="admin-operation-note strong">
                          <strong>公開時に確認工程を自動で開始します。</strong>
                          <span>
                            物語案を公開すると、進行状況を「写真とお話を確認しています」から「物語案2案をご確認ください」へ順番に記録します。
                          </span>
                        </aside>
                      )}
                    {!conceptPublishingStatusValid && (
                      <aside className="admin-operation-note warning">
                        <strong>現在の工程では公開できません。</strong>
                        <span>
                          進行状況「{ORDER_STATUS_LABELS[order.status]}
                          」を確認してください。制作開始後に内容を変更する場合は、先に適切な工程へ戻す必要があります。
                        </span>
                      </aside>
                    )}
                    <div className="admin-concepts">
                      {(
                        [
                          ["A", conceptA, setConceptA],
                          ["B", conceptB, setConceptB],
                        ] as const
                      ).map(([slot, value, setter]) => (
                        <div
                          className={
                            order.selected_concept_slot === slot
                              ? "selected"
                              : ""
                          }
                          key={slot}
                        >
                          <strong>
                            構成案 {slot}
                            {order.selected_concept_slot === slot && (
                              <span className="admin-concept-selected-badge">
                                お客様が選択
                              </span>
                            )}
                          </strong>
                          <label>
                            <span>タイトル</span>
                            <input
                              value={value.title}
                              onChange={(event) =>
                                setter({ ...value, title: event.target.value })
                              }
                              placeholder={`${order.pet_name}と歩いた季節`}
                            />
                          </label>
                          <label>
                            <span>トーン</span>
                            <input
                              value={value.tone}
                              onChange={(event) =>
                                setter({ ...value, tone: event.target.value })
                              }
                              placeholder="やわらかな水彩とガッシュ、静かな春の余韻"
                            />
                          </label>
                          <label>
                            <span>概要</span>
                            <textarea
                              rows={4}
                              value={value.summary}
                              onChange={(event) =>
                                setter({
                                  ...value,
                                  summary: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>5つの物語の場面</span>
                            <small>
                              すべて入力すると公開できます。顧客が送った物語と必ず1対1で紐づきます。
                            </small>
                          </label>
                          <div className="admin-concept-story-scenes">
                            {memories.map((memory) => (
                              <label key={`${slot}-${memory.id}`}>
                                <span>
                                  MEMORY{" "}
                                  {String(memory.sort_order).padStart(2, "0")} ·{" "}
                                  {memory.title}
                                </span>
                                <textarea
                                  rows={3}
                                  value={value.storyScenes[memory.id] ?? ""}
                                  onChange={(event) =>
                                    setter({
                                      ...value,
                                      storyScenes: {
                                        ...value.storyScenes,
                                        [memory.id]: event.target.value,
                                      },
                                    })
                                  }
                                  placeholder="この物語をどのような絵本場面としてつなぐか入力"
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={
                        saving ||
                        !photoAnalysisApproved ||
                        !conceptPublishingStatusValid
                      }
                      onClick={saveConcepts}
                    >
                      物語案2案を顧客へ公開する →
                    </button>
                  </section>

                  <section className="admin-card" id="admin-stills">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">STORYBOOK PAGES</p>
                        <h3>絵本ページと文章の確認依頼</h3>
                      </div>
                      <span>
                        {sceneStills.length}枚 · 確認版{" "}
                        {order.stills_review_version} · 調整{" "}
                        {order.stills_revision_used}/
                        {order.stills_revision_limit}回
                      </span>
                    </div>
                    <aside className="admin-operation-note strong">
                      <strong>
                        動画化の前に、絵本ページと物語の文章をお客様へ確認してもらいます。
                      </strong>
                      <span>
                        各ページには短い物語文が必要です。この文章はお客様の確認画面に表示され、承認後は自動編集で映像の字幕になります。
                      </span>
                    </aside>
                    {order.status === "stills_review" &&
                    order.stills_change_open ? (
                      <aside className="admin-operation-note warning">
                        <strong>
                          お客様から絵本ページの調整依頼があります。
                        </strong>
                        <span>
                          先に調整作業を開始し、差し替え後に改めて公開してください。再公開するまでお客様は承認できません。
                        </span>
                        <button
                          className="button button-primary"
                          type="button"
                          disabled={saving}
                          onClick={beginStillsRevision}
                        >
                          調整を開始する →
                        </button>
                      </aside>
                    ) : order.status === "stills_review" ? (
                      <aside className="admin-operation-note strong">
                        <strong>お客様の確認待ちです。</strong>
                        <span>
                          公開済みの絵本ページと文章は、確認中に差し替えできません。
                        </span>
                      </aside>
                    ) : (
                      !canPrepareStills && (
                        <aside className="admin-operation-note warning">
                          <strong>絵本ページを管理できません。</strong>
                          <span>
                            {!photoAnalysisApproved
                              ? "先に物語ごとの制作素材を承認してください。"
                              : order.payment_status !== "paid"
                                ? "先に入金確認を保存してください。"
                                : !consentCurrent
                                  ? "お客様による現在版の同意記録が必要です。"
                                  : "物語案の選択後に管理できます。"}
                          </span>
                        </aside>
                      )
                    )}
                    {order.stills_approved_at && (
                      <aside className="admin-operation-note strong">
                        <strong>
                          お客様が絵本ページと文章を確定済みです。
                        </strong>
                        <span>
                          {formatDateTime(order.stills_approved_at)} · 確認版{" "}
                          {order.stills_approved_version ??
                            order.stills_review_version}{" "}
                          を承認済みです。映像制作へ進めてください。
                        </span>
                      </aside>
                    )}
                    {sceneStills.length > 0 && (
                      <div className="admin-photo-grid">
                        {sceneStills.map((asset) => (
                          <div className="admin-still-item" key={asset.id}>
                            {assetUrls[asset.id] ? (
                              <a
                                href={assetUrls[asset.id]}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span
                                  className="admin-photo-thumb"
                                  role="img"
                                  aria-label={
                                    asset.scene_title ?? asset.original_filename
                                  }
                                  style={{
                                    backgroundImage: `url(${assetUrls[asset.id]})`,
                                  }}
                                />
                              </a>
                            ) : (
                              <span>読み込み中</span>
                            )}
                            <small>
                              {String(asset.scene_sort_order + 1).padStart(
                                2,
                                "0",
                              )}{" "}
                              · {asset.scene_title ?? asset.original_filename}
                            </small>
                            {canPrepareStills ? (
                              <label className="admin-scene-caption-editor">
                                <span>このページの物語文</span>
                                <textarea
                                  rows={3}
                                  maxLength={120}
                                  value={captionDrafts[asset.id] ?? ""}
                                  onChange={(event) =>
                                    setCaptionDrafts((current) => ({
                                      ...current,
                                      [asset.id]: event.target.value,
                                    }))
                                  }
                                />
                                <button
                                  className="button button-outline"
                                  type="button"
                                  disabled={
                                    saving ||
                                    !(captionDrafts[asset.id] ?? "").trim() ||
                                    (captionDrafts[asset.id] ?? "").trim() ===
                                      (asset.story_caption ?? "")
                                  }
                                  onClick={() => saveSceneCaption(asset)}
                                >
                                  文章を保存
                                </button>
                              </label>
                            ) : (
                              <p className="admin-scene-caption">
                                {asset.story_caption ?? "物語文なし"}
                              </p>
                            )}
                            {canPrepareStills && (
                              <button
                                className="button button-outline"
                                type="button"
                                disabled={saving}
                                onClick={() => deleteSceneStill(asset)}
                              >
                                削除
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {canPrepareStills && (
                      <div className="admin-form-grid">
                        <label>
                          <span>場面のタイトル（お客様に表示）</span>
                          <input
                            value={stillTitle}
                            maxLength={80}
                            onChange={(event) =>
                              setStillTitle(event.target.value)
                            }
                            placeholder="桜の花びらを追いかける場面"
                          />
                        </label>
                        <label>
                          <span>画像ファイル（JPG / PNG / WebP）</span>
                          <input
                            key={stillInputKey}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={saving}
                            onChange={(event) =>
                              setStillFile(event.target.files?.[0] ?? null)
                            }
                          />
                        </label>
                        <label className="wide">
                          <span>
                            このページの物語文{" "}
                            <small>映像の字幕になります</small>
                          </span>
                          <textarea
                            rows={3}
                            value={stillCaption}
                            maxLength={120}
                            onChange={(event) =>
                              setStillCaption(event.target.value)
                            }
                            placeholder="春の日、小さな手紙が届きました。"
                          />
                        </label>
                      </div>
                    )}
                    {canPrepareStills && (
                      <div className="admin-still-actions">
                        <button
                          className="button button-outline"
                          type="button"
                          disabled={
                            saving ||
                            !stillFile ||
                            !stillTitle.trim() ||
                            !stillCaption.trim()
                          }
                          onClick={uploadSceneStill}
                        >
                          {saving ? "追加中…" : "絵本ページを追加"}
                        </button>
                        <button
                          className="button button-primary"
                          type="button"
                          disabled={saving || !allSceneCaptionsReady}
                          onClick={publishSceneStills}
                        >
                          絵本ページと文章を公開する →
                        </button>
                      </div>
                    )}
                    <p className="admin-operation-note">
                      お客様の調整依頼は再公開するまで承認を止めます。公開後にメッセージを「対応済み」にし、確認版ごとに承認記録を残します。
                    </p>
                  </section>

                  <section className="admin-card" id="admin-render">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">STORYBOOK ASSEMBLY</p>
                        <h3>映像の自動編集</h3>
                      </div>
                      <span>
                        {renderClips.length}/{sceneStills.length}本
                        {estimatedSeconds > 0
                          ? ` · 約${Math.round(estimatedSeconds)}秒`
                          : ""}
                      </span>
                    </div>

                    {!renderAvailable && (
                      <aside className="admin-operation-note warning">
                        <strong>この環境では編集を実行できません。</strong>
                        <span>
                          映像の編集はローカルの制作環境でのみ動作します。ターミナルで{" "}
                          <code>npm run dev:operator</code> を実行し、localhost
                          の管理画面から操作してください。
                        </span>
                      </aside>
                    )}

                    {renderAvailable && (
                      <aside className="admin-operation-note strong">
                        <strong>
                          お客様が承認した絵本ページごとに、Runwayのクリップを1本ずつ追加します。
                        </strong>
                        <span>
                          ページ間は本をめくるように新しいページが前のページを覆って切り替わり、ページの間で映像が止まる静止画ホールドは入りません。編集後の映像はこの画面でのみ再生でき、公開ボタンを押すまでお客様には表示されません。
                        </span>
                      </aside>
                    )}

                    {renderAvailable && !canRenderFilm && (
                      <aside className="admin-operation-note warning">
                        <strong>まだ編集を開始できません。</strong>
                        <span>
                          {!photoAnalysisApproved
                            ? "先に物語ごとの制作素材を承認してください。"
                            : order.payment_status !== "paid"
                              ? "先に入金確認を保存してください。"
                              : !consentCurrent
                                ? "お客様による現在版の同意記録が必要です。"
                                : !order.stills_approved_at
                                  ? "お客様が絵本ページと文章を承認するまで編集できません。"
                                  : "進行状況を「約1分の映像を制作しています」へ進めてください。"}
                        </span>
                      </aside>
                    )}

                    {renderAvailable && sceneStills.length > 0 && (
                      <div className="admin-render-clips">
                        {sceneStills.map((still) => {
                          const clip = clipByStillId.get(still.id);
                          return (
                            <article
                              key={still.id}
                              className={
                                clip
                                  ? "admin-render-clip ready"
                                  : "admin-render-clip"
                              }
                            >
                              {assetUrls[still.id] ? (
                                <span
                                  className="admin-photo-thumb"
                                  role="img"
                                  aria-label={still.scene_title ?? "絵本ページ"}
                                  style={{
                                    backgroundImage: `url(${assetUrls[still.id]})`,
                                  }}
                                />
                              ) : (
                                <span className="admin-photo-thumb">
                                  読み込み中
                                </span>
                              )}
                              <div>
                                <strong>
                                  {String(still.scene_sort_order + 1).padStart(
                                    2,
                                    "0",
                                  )}{" "}
                                  · {still.scene_title ?? "場面"}
                                </strong>
                                {clip ? (
                                  <>
                                    {assetUrls[clip.id] && (
                                      <video
                                        className="admin-render-preview"
                                        src={assetUrls[clip.id]}
                                        controls
                                        preload="metadata"
                                      />
                                    )}
                                    <button
                                      className="button button-outline"
                                      type="button"
                                      disabled={
                                        saving || rendering || !canRenderFilm
                                      }
                                      onClick={() => deleteRenderClip(clip)}
                                    >
                                      クリップを削除
                                    </button>
                                  </>
                                ) : (
                                  <label
                                    className={
                                      saving || rendering || !canRenderFilm
                                        ? "admin-render-upload disabled"
                                        : "admin-render-upload"
                                    }
                                  >
                                    <input
                                      key={clipInputKey}
                                      type="file"
                                      accept="video/mp4,video/quicktime,video/webm"
                                      disabled={
                                        saving || rendering || !canRenderFilm
                                      }
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) uploadRenderClip(still, file);
                                      }}
                                    />
                                    <span>クリップを選ぶ</span>
                                  </label>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}

                    {renderAvailable && sceneStills.length === 0 && (
                      <p className="admin-empty-copy">
                        先に絵本ページと文章を登録し、お客様の承認を受けてください。
                      </p>
                    )}

                    {renderAvailable && canRenderFilm && (
                      <>
                        <div className="admin-form-grid">
                          <label>
                            <span>映像のタイトル</span>
                            <input
                              value={filmTitle}
                              onChange={(event) =>
                                setFilmTitle(event.target.value)
                              }
                              maxLength={80}
                              disabled={rendering}
                            />
                          </label>
                          <label>
                            <span>小見出し</span>
                            <input
                              value={filmKicker}
                              onChange={(event) =>
                                setFilmKicker(event.target.value)
                              }
                              maxLength={40}
                              disabled={rendering}
                            />
                          </label>
                          <label className="wide">
                            <span>
                              エンディングの文章{" "}
                              <small>改行がそのまま行になります</small>
                            </span>
                            <textarea
                              rows={4}
                              value={filmEndingText}
                              onChange={(event) =>
                                setFilmEndingText(event.target.value)
                              }
                              maxLength={600}
                              disabled={rendering}
                            />
                          </label>
                          <label>
                            <span>エンディングの署名</span>
                            <input
                              value={filmEndingMark}
                              onChange={(event) =>
                                setFilmEndingMark(event.target.value)
                              }
                              maxLength={40}
                              disabled={rendering}
                            />
                          </label>
                          <label>
                            <span>BGM</span>
                            <select
                              value={filmBgm}
                              onChange={(event) =>
                                setFilmBgm(event.target.value)
                              }
                              disabled={rendering}
                            >
                              <option value="">BGMなし</option>
                              {bgmTracks.map((track) => (
                                <option key={track} value={track}>
                                  {track}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <aside className="admin-operation-note">
                          各絵本ページに保存した物語文は、場面の長さに合わせて自動でフェード表示されます。動く絵本の色と紙の質感を保つため、シネマ調の黒帯・粒子加工は使用しません。
                        </aside>
                        <div className="admin-still-actions">
                          <button
                            className="button button-primary"
                            type="button"
                            disabled={
                              saving || rendering || renderClips.length < 3
                            }
                            onClick={startRender}
                          >
                            {rendering ? "編集中…" : "編集を開始する →"}
                          </button>
                        </div>
                        {renderClips.length > 0 && renderClips.length < 3 && (
                          <p className="admin-operation-note">
                            クリップが3本以上になると編集を開始できます。
                          </p>
                        )}
                        {renderProgress && (
                          <p className="admin-export-progress" role="status">
                            {renderProgress}
                          </p>
                        )}
                        {rendering && (
                          <p className="admin-operation-note">
                            編集中はこのタブを閉じないでください。数分かかります。
                          </p>
                        )}
                      </>
                    )}

                    {assembledFilms.length > 0 && (
                      <div className="admin-video-history">
                        <strong>編集された映像</strong>
                        {assembledFilms.map((asset) => (
                          <div className="admin-render-result" key={asset.id}>
                            {assetUrls[asset.id] ? (
                              <video
                                src={assetUrls[asset.id]}
                                controls
                                preload="metadata"
                              />
                            ) : (
                              <span>読み込み中</span>
                            )}
                            <div>
                              <small>
                                {formatDate(asset.created_at)} ·{" "}
                                {(asset.file_size / 1024 / 1024).toFixed(1)} MB
                              </small>
                              <button
                                className="button button-primary"
                                type="button"
                                disabled={
                                  saving || rendering || !canUploadReview
                                }
                                onClick={() => promoteAssembledFilm(asset)}
                              >
                                確認映像として公開する →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="admin-operation-note">
                      編集された映像はお客様には表示されません。内容を確認したうえで「確認映像として公開する」を押すと、お客様の制作室に表示され、進行状況が「完成前の映像をご確認ください」へ進みます。
                    </p>
                  </section>

                  <section className="admin-card" id="admin-revisions">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">REVISION REQUESTS</p>
                        <h3>修正依頼</h3>
                      </div>
                      <span>
                        {order.revision_used}/{order.revision_limit}回使用
                      </span>
                    </div>
                    {revisions.length ? (
                      <div className="admin-work-list">
                        {revisions.map((revision) => (
                          <article key={revision.id}>
                            <div>
                              <span
                                className={
                                  revision.status === "open"
                                    ? "work-status open"
                                    : "work-status"
                                }
                              >
                                {revision.status === "open"
                                  ? "対応が必要"
                                  : "対応済み"}
                              </span>
                              <small>{formatDate(revision.created_at)}</small>
                            </div>
                            <strong>{revision.category}</strong>
                            <p>{revision.body}</p>
                            {revision.status === "open" && (
                              <button
                                className="button button-outline"
                                type="button"
                                disabled={saving}
                                onClick={() => resolveRevision(revision.id)}
                              >
                                対応完了にする
                              </button>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-empty-copy">
                        修正依頼はまだありません。
                      </p>
                    )}
                    <p className="admin-operation-note">
                      修正版を「完成前の確認映像」として公開してから、該当依頼を対応完了にしてください。上限はDBでも
                      {order.revision_limit}回に制限されています。
                    </p>
                  </section>

                  <section className="admin-card" id="admin-metrics">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">FIRST 10 METRICS</p>
                        <h3>制作コストの記録</h3>
                      </div>
                      <span>運営者のみ</span>
                    </div>
                    <p className="admin-operation-note">
                      最初の10組は、実制作にかかった時間とRunway使用量を残します。次の料金・制作枠を判断するための内部メモで、お客様には表示されません。
                    </p>
                    <div className="admin-form-grid">
                      <label>
                        <span>制作時間（分）</span>
                        <input
                          type="number"
                          min="0"
                          value={productionWorkMinutes}
                          onChange={(event) =>
                            setProductionWorkMinutes(Number(event.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span>Runway使用クレジット</span>
                        <input
                          type="number"
                          min="0"
                          value={runwayCreditsUsed}
                          onChange={(event) =>
                            setRunwayCreditsUsed(Number(event.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span>生成回数</span>
                        <input
                          type="number"
                          min="0"
                          value={runwayGenerationCount}
                          onChange={(event) =>
                            setRunwayGenerationCount(Number(event.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span>再生成回数</span>
                        <input
                          type="number"
                          min="0"
                          value={runwayRetryCount}
                          onChange={(event) =>
                            setRunwayRetryCount(Number(event.target.value))
                          }
                        />
                      </label>
                      <label className="wide">
                        <span>制作メモ（任意）</span>
                        <textarea
                          rows={3}
                          maxLength={3000}
                          value={productionLog}
                          onChange={(event) =>
                            setProductionLog(event.target.value)
                          }
                          placeholder="例：外見テストを2回作成。リードの形を修正して3回目を採用。"
                        />
                      </label>
                    </div>
                    <button
                      className="button button-outline"
                      type="button"
                      disabled={saving}
                      onClick={saveProductionMetrics}
                    >
                      制作記録を保存
                    </button>
                  </section>

                  <section className="admin-card" id="admin-video">
                    <div className="card-head">
                      <div>
                        <p className="eyebrow">VIDEO WORKFLOW</p>
                        <h3>
                          {videoMode === "review"
                            ? "完成前の確認映像"
                            : "完成映像の最終納品"}
                        </h3>
                      </div>
                      <span>MP4 / MOV / WebM</span>
                    </div>
                    <div className="admin-video-tabs">
                      <button
                        type="button"
                        className={videoMode === "review" ? "active" : ""}
                        onClick={() => {
                          setVideoMode("review");
                          clearVideo();
                        }}
                      >
                        1. 顧客確認用
                      </button>
                      <button
                        type="button"
                        className={videoMode === "final" ? "active" : ""}
                        onClick={() => {
                          setVideoMode("final");
                          clearVideo();
                        }}
                      >
                        2. 最終納品
                      </button>
                    </div>
                    {videoMode === "review" ? (
                      <>
                        <aside className="admin-operation-note strong">
                          <strong>
                            このアップロードでは納品済みになりません。
                          </strong>
                          <span>
                            お客様の制作室に確認映像を表示し、状態を「完成前の映像をご確認ください」へ進めます。
                          </span>
                        </aside>
                        {!canUploadReview && (
                          <aside className="admin-operation-note warning">
                            <strong>確認映像を公開できません。</strong>
                            <span>
                              {order.payment_status !== "paid"
                                ? "先に入金確認を保存してください。"
                                : !consentCurrent
                                  ? "お客様による現在版の同意記録が必要です。"
                                  : "物語案の選択後、進行状況を「動く絵本を制作しています」へ進めてください。"}
                            </span>
                          </aside>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="admin-form-grid">
                          <label>
                            <span>完成映像のタイトル</span>
                            <input
                              value={deliveryTitle}
                              onChange={(event) =>
                                setDeliveryTitle(event.target.value)
                              }
                            />
                          </label>
                          <label className="wide">
                            <span>お客様へのメッセージ</span>
                            <textarea
                              rows={3}
                              value={deliveryMessage}
                              onChange={(event) =>
                                setDeliveryMessage(event.target.value)
                              }
                            />
                          </label>
                        </div>
                        {!canUploadFinal && (
                          <aside className="admin-operation-note warning">
                            <strong>まだ最終納品できません。</strong>
                            <span>
                              {order.payment_status !== "paid"
                                ? "入金確認が必要です。"
                                : !consentCurrent
                                  ? "現在版の同意記録が必要です。"
                                  : openRevisions.length
                                    ? "未対応の修正依頼をすべて解決してください。"
                                    : !order.customer_approved_at
                                      ? "お客様が確認映像の「この映像で確定する」を押すまでお待ちください。"
                                      : "お客様が承認した映像と制作工程を確認してください。"}
                            </span>
                          </aside>
                        )}
                      </>
                    )}
                    <label
                      className={
                        saving ||
                        (videoMode === "review"
                          ? !canUploadReview
                          : !canUploadFinal)
                          ? "admin-video-upload disabled"
                          : "admin-video-upload"
                      }
                    >
                      <input
                        key={videoInputKey}
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        disabled={
                          saving ||
                          (videoMode === "review"
                            ? !canUploadReview
                            : !canUploadFinal)
                        }
                        onChange={selectVideo}
                      />
                      <strong>
                        {videoFile
                          ? "別の映像を選ぶ"
                          : videoMode === "review"
                            ? "確認映像を選ぶ"
                            : "完成映像を選ぶ"}
                      </strong>
                      <small>
                        選択しただけでは公開・納品されません。次の確認欄で確定します。
                      </small>
                    </label>
                    {videoFile && (
                      <div
                        className="admin-delivery-review"
                        role="group"
                        aria-label="映像アップロードの最終確認"
                      >
                        <p className="eyebrow">UPLOAD CHECK</p>
                        <h4>
                          {videoMode === "review"
                            ? "まだ顧客へ公開されていません"
                            : "まだ納品されていません"}
                        </h4>
                        <dl>
                          <div>
                            <dt>お客様</dt>
                            <dd>
                              {order.pet_name}ちゃん ·{" "}
                              {customer?.full_name ||
                                customer?.email ||
                                "登録ユーザー"}
                            </dd>
                          </div>
                          <div>
                            <dt>ファイル</dt>
                            <dd>{videoFile.name}</dd>
                          </div>
                          <div>
                            <dt>サイズ</dt>
                            <dd>
                              {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                            </dd>
                          </div>
                          <div>
                            <dt>用途</dt>
                            <dd>
                              {videoMode === "review"
                                ? "完成前の顧客確認"
                                : "最終納品"}
                            </dd>
                          </div>
                        </dl>
                        <label className="admin-delivery-check">
                          <input
                            type="checkbox"
                            checked={videoChecked}
                            onChange={(event) =>
                              setVideoChecked(event.target.checked)
                            }
                          />
                          <span>お客様名・ファイル名・用途を確認しました</span>
                        </label>
                        <div>
                          <button
                            className="button button-outline"
                            type="button"
                            disabled={saving}
                            onClick={clearVideo}
                          >
                            選び直す
                          </button>
                          <button
                            className="button button-primary"
                            type="button"
                            disabled={
                              saving ||
                              !videoChecked ||
                              (videoMode === "review"
                                ? !canUploadReview
                                : !canUploadFinal)
                            }
                            onClick={uploadVideo}
                          >
                            {saving
                              ? "アップロード中…"
                              : videoMode === "review"
                                ? "確認映像として公開する →"
                                : "確認した内容で納品する →"}
                          </button>
                        </div>
                      </div>
                    )}
                    {reviewVideos.length > 0 && (
                      <div className="admin-video-history">
                        <strong>公開済みの確認映像</strong>
                        {reviewVideos.map((asset) => (
                          <a
                            href={assetUrls[asset.id]}
                            target="_blank"
                            rel="noreferrer"
                            key={asset.id}
                          >
                            {asset.original_filename}
                            <small>{formatDate(asset.created_at)}</small>
                          </a>
                        ))}
                      </div>
                    )}
                    {videoMode === "final" && finalVideos.length > 0 && (
                      <div className="admin-video-history">
                        <strong>登録済みの完成映像</strong>
                        {finalVideos.map((asset) => (
                          <div className="admin-video-retry" key={asset.id}>
                            <a
                              href={assetUrls[asset.id]}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {asset.original_filename}
                              <small>{formatDate(asset.created_at)}</small>
                            </a>
                            <button
                              className="button button-outline"
                              type="button"
                              disabled={saving || !canUploadFinal}
                              onClick={() => retryDelivery(asset)}
                            >
                              この映像で納品を再試行
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
                <aside
                  className="admin-card admin-chat-panel"
                  id="admin-message"
                >
                  <div className="card-head">
                    <div>
                      <p className="eyebrow">MESSAGES</p>
                      <h3>お客様との連絡</h3>
                    </div>
                    <span>{openMessages.length}件 未対応</span>
                  </div>
                  <p className="admin-chat-guide">
                    ここから送った内容は制作室に保存され、お客様にはメールでも新着をお知らせします。
                  </p>
                  {customerInputPending && (
                    <aside className="admin-operation-note warning">
                      <strong>
                        送信すると「お客様へ追加確認が必要」へ変更します。
                      </strong>
                      <span>
                        確認したい内容を書いてから送信してください。まだ状態は変わっていません。
                        <button
                          type="button"
                          className="admin-inline-cancel"
                          onClick={cancelCustomerInputRequest}
                        >
                          この連絡を取りやめる
                        </button>
                      </span>
                    </aside>
                  )}
                  <div
                    className="admin-work-list admin-message-list"
                    ref={messageListRef}
                  >
                    {messages.length ? (
                      messages.map((message) => {
                        const fromCustomer =
                          message.sender_id === order.user_id;
                        return (
                          <article
                            className={fromCustomer ? "customer" : "admin"}
                            key={message.id}
                          >
                            <div>
                              <span
                                className={
                                  fromCustomer && message.status === "open"
                                    ? "work-status open"
                                    : "work-status"
                                }
                              >
                                {fromCustomer
                                  ? message.status === "open"
                                    ? "未対応"
                                    : "対応済み"
                                  : "運営から送信"}
                              </span>
                              <small>
                                {formatDateTime(message.created_at)}
                              </small>
                            </div>
                            <p>{message.body}</p>
                            {fromCustomer && message.status === "open" && (
                              <button
                                className="button button-outline"
                                type="button"
                                disabled={saving}
                                onClick={() => resolveMessage(message.id)}
                              >
                                対応済みにする
                              </button>
                            )}
                          </article>
                        );
                      })
                    ) : (
                      <p className="admin-empty-copy">
                        メッセージはまだありません。
                      </p>
                    )}
                  </div>
                  <form className="admin-message-form" onSubmit={sendMessage}>
                    <label>
                      <span>お客様へのメッセージ</span>
                      <textarea
                        ref={messageComposerRef}
                        name="body"
                        rows={5}
                        maxLength={3000}
                        value={messageDraft}
                        onChange={(event) =>
                          setMessageDraft(event.target.value)
                        }
                        placeholder="追加写真のお願い、確認事項、進行状況など"
                      />
                      <small>
                        メール本文には内容を載せず、制作室に新着があることだけをお知らせします。
                      </small>
                    </label>
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={saving || !messageDraft.trim()}
                    >
                      {saving
                        ? "送信中…"
                        : customerInputPending
                          ? "送信して追加確認へ変更する →"
                          : "メッセージを送る"}
                    </button>
                  </form>
                </aside>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
