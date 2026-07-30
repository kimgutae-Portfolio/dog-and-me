/**
 * Shared IP allowlist logic for the /admin restriction.
 *
 * Lives in one place on purpose: middleware.ts enforces it and /api/whoami
 * reports it. If the two had separate implementations the diagnostic could
 * report "allowed" for an address the middleware then blocks.
 *
 * Edge-runtime safe — pure JS, no Node APIs.
 */

type ParsedIp = { version: 4 | 6; value: bigint };

const LOOPBACK = new Set(["127.0.0.1", "::1"]);

// tsconfig targets ES2017, which forbids BigInt literals (0n). The BigInt type
// itself is available via the esnext lib, so the constructor is used instead.
const ZERO = BigInt(0);
const SHIFT_8 = BigInt(8);
const SHIFT_16 = BigInt(16);
const MASK_16 = BigInt(0xffff);

function parseIpv4(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = ZERO;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << SHIFT_8) | BigInt(octet);
  }
  return value;
}

function parseIpv6(ip: string): bigint | null {
  let text = ip;

  // An embedded IPv4 tail (::ffff:1.2.3.4, 2002::1.2.3.4) becomes two groups.
  const embedded = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (embedded) {
    const v4 = parseIpv4(embedded[1]);
    if (v4 === null) return null;
    const high = (v4 >> SHIFT_16).toString(16);
    const low = (v4 & MASK_16).toString(16);
    text = `${text.slice(0, embedded.index)}${high}:${low}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const expand = (chunk: string) => (chunk ? chunk.split(":") : []);
  const head = expand(halves[0]);
  const tail = halves.length === 2 ? expand(halves[1]) : [];

  // Without "::" the address must be fully written out.
  if (halves.length === 1 && head.length !== 8) return null;
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  if (halves.length === 2 && fill < 1) return null;

  const groups = [...head, ...Array(fill).fill("0"), ...tail];
  let value = ZERO;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
    value = (value << SHIFT_16) | BigInt(parseInt(group, 16));
  }
  return value;
}

/** Normalises IPv4-mapped IPv6 so an IPv4 rule matches an IPv6-reported address. */
export function normaliseIp(raw: string): string {
  const ip = raw.trim().toLowerCase();
  // Strip a zone index (fe80::1%en0) and any bracket form ([::1]:443).
  const bare = ip.replace(/^\[|\]$/g, "").split("%")[0]!;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(bare);
  return mapped ? mapped[1]! : bare;
}

function parseIp(raw: string): ParsedIp | null {
  const ip = normaliseIp(raw);
  if (ip.includes(":")) {
    const value = parseIpv6(ip);
    return value === null ? null : { version: 6, value };
  }
  const value = parseIpv4(ip);
  return value === null ? null : { version: 4, value };
}

/** True for loopback and RFC1918 / unique-local / link-local ranges. */
export function isPrivateIp(raw: string): boolean {
  const ip = normaliseIp(raw);
  if (LOOPBACK.has(ip)) return true;
  return /^10\./.test(ip)
    || /^192\.168\./.test(ip)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    || /^f[cd]/.test(ip)
    || /^fe80:/.test(ip);
}

/** Matches a plain address or a CIDR range, for both IPv4 and IPv6. */
export function ipMatchesRule(rawIp: string, rule: string): boolean {
  const trimmed = rule.trim().toLowerCase();
  if (!trimmed) return false;

  const parsedIp = parseIp(rawIp);
  if (!parsedIp) return false;

  if (!trimmed.includes("/")) {
    const parsedRule = parseIp(trimmed);
    return Boolean(parsedRule)
      && parsedRule!.version === parsedIp.version
      && parsedRule!.value === parsedIp.value;
  }

  const [networkText, bitsText] = trimmed.split("/");
  const network = parseIp(networkText!);
  const bits = Number(bitsText);
  if (!network || network.version !== parsedIp.version) return false;

  const width = network.version === 4 ? 32 : 128;
  if (!Number.isInteger(bits) || bits < 0 || bits > width) return false;

  const shift = BigInt(width - bits);
  return (parsedIp.value >> shift) === (network.value >> shift);
}

export function adminAllowlist(): string[] {
  return (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Fail-open: an empty allowlist permits everything, so a dynamic home IP can
 * never permanently lock the operator out of their own admin screen.
 */
export function isAdminIpAllowed(ip: string): boolean {
  const allowlist = adminAllowlist();
  if (allowlist.length === 0) return true;
  if (!ip || isPrivateIp(ip)) return true;
  return allowlist.some((rule) => ipMatchesRule(ip, rule));
}

/**
 * CIDR ranges the observed address falls into, widest last.
 *
 * Consumer connections rotate: IPv6 privacy extensions change the host part
 * every few hours while the prefix stays put, and dynamic IPv4 changes on
 * reconnect. Registering a single address therefore locks the operator out
 * within a day; registering the right prefix does not.
 */
export function suggestedRanges(raw: string): { cidr: string; note: string }[] {
  const parsed = parseIp(raw);
  if (!parsed) return [];
  const ip = normaliseIp(raw);

  if (parsed.version === 4) {
    const octets = ip.split(".");
    return [
      { cidr: ip, note: "この住所のみ（固定 IP 契約のとき）" },
      { cidr: `${octets[0]}.${octets[1]}.${octets[2]}.0/24`, note: "末尾だけが変わる場合" },
      { cidr: `${octets[0]}.${octets[1]}.0.0/16`, note: "さらに広い範囲（かなり緩くなる）" },
    ];
  }

  // Rebuild from the parsed value so compressed forms expand consistently.
  // i counts down from the most significant group, so push (not unshift) keeps
  // left-to-right order.
  const groups: string[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    groups.push(((parsed.value >> BigInt(i * 16)) & MASK_16).toString(16));
  }
  return [
    { cidr: `${groups.slice(0, 4).join(":")}::/64`, note: "末尾だけが変わる場合（まずこれを試す）" },
    { cidr: `${groups.slice(0, 3).join(":")}::/48`, note: "4 番目のかたまりも変わる場合" },
    { cidr: `${groups.slice(0, 2).join(":")}::/32`, note: "ISP 全体。かなり緩くなるので最後の手段" },
  ];
}

export function clientIp(request: { headers: { get(name: string): string | null } }): string {
  // On Vercel the left-most x-forwarded-for entry is the real client.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? "";
}
