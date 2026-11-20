export const MEMORY_FILM_PRICING = {
  planId: "memory-film",
  currency: "JPY",
  price: 12_800,
  taxIncluded: true,
} as const;

export const MEMORY_VIDEO_PRICING = {
  planId: "video-only",
  currency: "JPY",
  price: 7_800,
  taxIncluded: true,
} as const;

export type MemoryPlanId =
  | typeof MEMORY_FILM_PRICING.planId
  | typeof MEMORY_VIDEO_PRICING.planId;

const fullPlan = {
  ...MEMORY_FILM_PRICING,
  name: "絵本＋ホームページプラン",
  includesWebsite: true,
  includesLineStickers: true,
  includesIllustrations: true,
} as const;

const videoPlan = {
  ...MEMORY_VIDEO_PRICING,
  name: "動画プラン",
  includesWebsite: false,
  includesLineStickers: false,
  includesIllustrations: false,
} as const;

export function isMemoryPlanId(value: unknown): value is MemoryPlanId {
  return value === MEMORY_FILM_PRICING.planId || value === MEMORY_VIDEO_PRICING.planId;
}

export function getMemoryPlan(planId?: string | null) {
  // Orders created before plan selection belong to the original full plan.
  return planId === MEMORY_VIDEO_PRICING.planId ? videoPlan : fullPlan;
}

export function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}
