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
  campaign_id: string | null;
  selected_concept_slot: "A" | "B" | null;
  due_date: string | null;
  admin_notes: string | null;
  revision_limit: number;
  revision_used: number;
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
  customer_approved_at: string | null;
  customer_approved_by: string | null;
  customer_approved_review_asset_id: string | null;
  draft_expires_at: string | null;
  stage_updated_at: string;
  created_at: string;
  updated_at: string;
};

export type OrderAsset = {
  id: string;
  order_id: string;
  user_id: string;
  memory_id: string | null;
  category: "source_image" | "source_video" | "review_video" | "final_video" | "thumbnail";
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  album_visible: boolean;
  album_caption: string | null;
  album_sort_order: number;
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
  dog_behavior: string;
  created_at: string;
  updated_at: string;
};

export type MemoryShare = {
  token: string;
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
  concepts_ready: "コンセプト2案をご確認ください",
  concept_selected: "選んだ物語を構成しています",
  production: "約1分の映画を制作しています",
  customer_review: "完成前の映像をご確認ください",
  revision_requested: "修正内容を反映しています",
  quality_check: "最終確認をしています",
  delivered: "映画をお届けしました",
  cancelled: "キャンセル",
};
