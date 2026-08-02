export type ProfileRole = "customer" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  primary_pet_name: string | null;
  role: ProfileRole;
};

export type OrderStatus =
  | "awaiting_materials"
  | "materials_submitted"
  | "reviewing_materials"
  | "concepts_ready"
  | "concept_selected"
  | "stills_review"
  | "production"
  | "customer_review"
  | "revision_requested"
  | "quality_check"
  | "delivered"
  | "cancelled";

export type PeopleHandling =
  | "not_applicable"
  | "dog_only_crop"
  | "anonymous_person"
  | "original_still"
  | "consult";

export type AppearancePolicy =
  | "photo_era_by_scene"
  | "current_appearance"
  | "selected_period";

export type PhotoAnalysisStatus =
  | "not_started"
  | "ai_analysis_complete"
  | "pending_operator_review"
  | "approved"
  | "needs_customer_input";

export type WanMemoryProductionFields = {
  primaryFacePhotoId: string | null;
  primaryBodyPhotoId: string | null;
  sideTailPhotoId: string | null;
  appearancePolicy: AppearancePolicy | null;
  selectedAppearanceDescription: string | null;
  selectedAppearancePhotoIds: string[];
  ownerLockedTraits: string[];
  aiReconstructionAcknowledged: boolean;
  photoAnalysisStatus: PhotoAnalysisStatus;
  photoAnalysisApprovedAt: string | null;
  photoAnalysisApprovedBy: string | null;
};

export type MemoryOrder = {
  id: string;
  user_id: string;
  order_number: string;
  pet_name: string;
  name_kana: string | null;
  breed: string;
  age_text: string | null;
  purpose: string;
  personality: string[];
  first_meeting: string | null;
  favorite_memory: string | null;
  message_to_pet: string | null;
  avoid_notes: string | null;
  style: string;
  aspect_ratio: string;
  narration: string;
  bgm: string;
  status: OrderStatus;
  payment_status: "pending" | "invoice_sent" | "paid" | "refunded";
  quoted_price: number;
  regular_price: number;
  currency: string;
  campaign_id: string | null;
  selected_concept_slot: "A" | "B" | null;
  due_date: string | null;
  admin_notes: string | null;
  revision_limit: number;
  revision_used: number;
  stills_revision_limit: number;
  stills_revision_used: number;
  stills_change_open: boolean;
  stills_review_version: number;
  stills_approved_at: string | null;
  stills_approved_by: string | null;
  stills_approved_version: number | null;
  stills_approved_asset_ids: string[] | null;
  consented_at: string | null;
  terms_version: string | null;
  privacy_version: string | null;
  external_ai_consent_at: string | null;
  ai_notice_version: string | null;
  contains_people: boolean | null;
  people_handling: PeopleHandling | null;
  contains_minors: boolean | null;
  photo_rights_consented_at: string | null;
  photo_rights_consent_version: string | null;
  depicted_people_consented_at: string | null;
  depicted_people_consent_version: string | null;
  minor_guardian_consented_at: string | null;
  minor_guardian_consent_version: string | null;
  people_policy_version: string | null;
  primary_face_photo_id: string | null;
  primary_body_photo_id: string | null;
  side_tail_photo_id: string | null;
  appearance_policy: AppearancePolicy | null;
  selected_appearance_description: string | null;
  selected_appearance_photo_ids: string[] | null;
  owner_locked_traits: string[] | null;
  ai_reconstruction_acknowledged: boolean | null;
  photo_analysis_status: PhotoAnalysisStatus | null;
  photo_analysis_approved_at: string | null;
  photo_analysis_approved_by: string | null;
  customer_approved_at: string | null;
  customer_approved_by: string | null;
  customer_approved_review_asset_id: string | null;
  production_started_at: string | null;
  production_completed_at: string | null;
  production_work_minutes: number;
  runway_credits_used: number;
  runway_generation_count: number;
  runway_retry_count: number;
  production_log: string | null;
  draft_expires_at: string | null;
  stage_updated_at: string;
  created_at: string;
  updated_at: string;
};

export function getProductionFields(
  order: Partial<MemoryOrder>,
): WanMemoryProductionFields {
  return {
    primaryFacePhotoId: order.primary_face_photo_id ?? null,
    primaryBodyPhotoId: order.primary_body_photo_id ?? null,
    sideTailPhotoId: order.side_tail_photo_id ?? null,
    appearancePolicy: order.appearance_policy ?? null,
    selectedAppearanceDescription:
      order.selected_appearance_description ?? null,
    selectedAppearancePhotoIds: Array.isArray(
      order.selected_appearance_photo_ids,
    )
      ? order.selected_appearance_photo_ids
      : [],
    ownerLockedTraits: Array.isArray(order.owner_locked_traits)
      ? order.owner_locked_traits
      : [],
    aiReconstructionAcknowledged: order.ai_reconstruction_acknowledged === true,
    photoAnalysisStatus: order.photo_analysis_status ?? "needs_customer_input",
    photoAnalysisApprovedAt: order.photo_analysis_approved_at ?? null,
    photoAnalysisApprovedBy: order.photo_analysis_approved_by ?? null,
  };
}

export type OrderAsset = {
  id: string;
  order_id: string;
  user_id: string;
  memory_id: string | null;
  category:
    | "source_image"
    | "source_video"
    | "scene_still"
    | "render_clip"
    | "assembled_film"
    | "review_video"
    | "final_video"
    | "thumbnail";
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  album_visible: boolean;
  album_caption: string | null;
  album_sort_order: number;
  scene_title: string | null;
  story_caption: string | null;
  scene_sort_order: number;
  source_still_asset_id: string | null;
  created_at: string;
};

export type SecurityEvent = {
  id: number;
  actor_id: string | null;
  target_user_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

/** Japanese labels for the audit log shown in the admin security section. */
export const SECURITY_EVENT_LABELS: Record<string, string> = {
  login_succeeded: "ログイン成功",
  login_failed: "ログイン失敗",
  login_locked: "アカウントをロック",
  login_rejected_locked: "ロック中のログイン試行",
  profile_role_changed: "権限の変更",
  mfa_enrolled: "二段階認証を登録",
  mfa_unenrolled: "二段階認証を解除",
};

export type RenderClipRole = "intro" | "memory" | "ending";

/** One clip in an assembly request, sent to /api/admin/render. */
export type RenderRequestItem = {
  clipAssetId: string;
  role: RenderClipRole;
};

export type RenderRequest = {
  orderId: string;
  items: RenderRequestItem[];
  title: string;
  kicker: string;
  endingText: string;
  endingMark: string;
  bgmFile: string | null;
  letterboxPct: number;
  filmLook: boolean;
};

/** Newline-delimited JSON streamed back while the film is being assembled. */
export type RenderProgressEvent =
  | { type: "progress"; step: string; message: string }
  | { type: "done"; assetId: string; durationSeconds: number; fileSize: number }
  | { type: "error"; message: string };

export type StoryDraftRecord = {
  id: string;
  user_id: string;
  pending_order_id: string | null;
  data: Record<string, unknown>;
  current_step: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type StoryDraftAsset = {
  id: string;
  draft_id: string;
  user_id: string;
  client_key: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  created_at: string;
};

export type OrderMemory = {
  id: string;
  order_id: string;
  user_id: string;
  client_key: string;
  sort_order: number;
  title: string;
  when_text: string | null;
  location: string | null;
  description: string;
  dog_behavior: string | null;
  created_at: string;
  updated_at: string;
};

export type MemoryShare = {
  code: string;
  active: boolean;
};

export type FilmConcept = {
  id: string;
  order_id: string;
  slot: "A" | "B";
  title: string;
  tone: string;
  summary: string;
  scenes: string[];
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

export type Delivery = {
  id: string;
  order_id: string;
  final_asset_id: string;
  title: string;
  customer_message: string | null;
  delivered_at: string;
};

export type OrderMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  status: "open" | "resolved";
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

export type RevisionRequest = {
  id: string;
  order_id: string;
  user_id: string;
  category: string;
  body: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_materials: "素材の追加待ち",
  materials_submitted: "ご相談を受け付けました",
  reviewing_materials: "写真とお話を確認しています",
  concepts_ready: "物語案2案をご確認ください",
  concept_selected: "選んだ物語の絵本ページを描いています",
  stills_review: "絵本ページと文章をご確認ください",
  production: "動く絵本を制作しています",
  customer_review: "完成前の動く絵本をご確認ください",
  revision_requested: "修正内容を反映しています",
  quality_check: "最終確認をしています",
  delivered: "完成した動く絵本をお届けしました",
  cancelled: "キャンセル",
};
