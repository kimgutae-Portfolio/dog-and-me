export type ProfileRole = "customer" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
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
  created_at: string;
  updated_at: string;
};

export type OrderAsset = {
  id: string;
  order_id: string;
  user_id: string;
  category: "source_image" | "source_video" | "final_video" | "thumbnail";
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
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
