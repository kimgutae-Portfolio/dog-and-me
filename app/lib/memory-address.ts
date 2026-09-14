/** Customer-picked addresses never derive from an email or transliteration. */
export function isMemoryAddress(value: string): boolean {
  return value.length >= 3 && value.length <= 40 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    !["admin", "api", "auth", "new", "edit", "preview", "support"].includes(value);
}

export function memoryAddressPath(address: string): string {
  return `/memory/${encodeURIComponent(address)}`;
}
