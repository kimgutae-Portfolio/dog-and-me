export type StripeMode = "test" | "live";

export function getStripeMode(): StripeMode {
  const mode = process.env.STRIPE_MODE?.trim().toLowerCase();
  if (mode === "test" || mode === "live") return mode;
  throw new Error("stripe_mode_not_configured");
}

export function isStripeLiveMode(mode = getStripeMode()) {
  return mode === "live";
}

export function assertStripeSecretKeyMode(
  secretKey: string,
  mode = getStripeMode(),
) {
  const expectedPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  if (!secretKey.startsWith(expectedPrefix)) {
    throw new Error("stripe_key_mode_mismatch");
  }
}
