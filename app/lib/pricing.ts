export const MEMORY_FILM_PRICING = {
  planId: "memory-film",
  currency: "JPY",
  launchPrice: 16_800,
  regularPrice: 19_800,
  launchLimit: 20,
  taxIncluded: true,
  campaignId: "launch-monitor-16800-20",
} as const;

export function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}
