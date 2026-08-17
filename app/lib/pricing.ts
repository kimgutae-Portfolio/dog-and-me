export const MEMORY_FILM_PRICING = {
  planId: "memory-film",
  currency: "JPY",
  launchPrice: 16_800,
  regularPrice: 19_800,
  launchLimit: 10,
  taxIncluded: true,
  campaignId: "launch-monitor-16800-10",
} as const;

export function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}
