export const MEMORY_FILM_PRICING = {
  planId: "memory-film",
  currency: "JPY",
  price: 12_800,
  taxIncluded: true,
} as const;

export function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}
