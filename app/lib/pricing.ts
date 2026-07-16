export const MEMORY_FILM_PRICING = {
  planId: "memory-film",
  currency: "JPY",
  launchPrice: 24_800,
  regularPrice: 29_800,
  launchLimit: 10,
  taxIncluded: true,
  campaignId: "launch-monitor-10",
} as const;

export function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}
