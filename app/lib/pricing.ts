export const MEMORY_FILM_PRICING = {
  planId: "memory-film",
  currency: "JPY",
  launchPrice: 12_800,
  regularPrice: 14_800,
  launchLimit: 20,
  taxIncluded: true,
  campaignId: "launch-monitor-12800-20",
} as const;

export function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}
