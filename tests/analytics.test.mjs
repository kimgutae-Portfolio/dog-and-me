import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function moduleFor(file, mocks = {}, globals = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (id) => mocks[id] ?? require(id), URL, URLSearchParams, Date, Set, ...globals });
  return exports;
}
const config = moduleFor("app/lib/analytics-config.ts");
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
function browser(path = "/studio?order=private-order&session_id=private-session#payment") {
  const location = new URL(`https://www.wanmemory.com${path}`);
  const window = { location, localStorage: storage(), sessionStorage: storage() };
  const document = { referrer: "https://www.wanmemory.com/auth?access_token=secret#token" };
  const analytics = moduleFor("app/lib/analytics.ts", { "./analytics-config": config }, { window, document });
  return { window, document, analytics };
}

test("analytics excludes customer/operator paths and strips private URL data without losing landing attribution", () => {
  for (const path of ["/admin", "/admin/orders", "/memory/private", "/film/customer", "/moka01"]) assert.equal(config.isAnalyticsPath(path), false);
  for (const path of ["/", "/start", "/auth", "/story", "/studio", "/film/moka-demo", "/guides", "/inu-omoide-zukuri", "/pet-loss-aiken-omoide", "/dog-birthday-message"]) assert.equal(config.isAnalyticsPath(path), true);
  assert.equal(config.analyticsPageLocation("https://www.wanmemory.com/studio?order=UUID&session_id=secret#payment"), "https://www.wanmemory.com/studio");
  assert.equal(config.analyticsPageLocation("https://www.wanmemory.com/?utm_source=google&utm_campaign=pet_memory&gclid=click-ID&email=hello@example.com#x"), "https://www.wanmemory.com/?utm_source=google&utm_campaign=pet_memory&gclid=click-ID");
  assert.equal(config.analyticsPageLocation("https://www.wanmemory.com/private-dog?token=secret"), "");
  assert.equal(config.isProductionAnalyticsHost("localhost"), false);
  assert.equal(config.isProductionAnalyticsHost("preview.vercel.app"), false);
});

test("referrer sanitization preserves Google and Instagram acquisition origins without private paths", () => {
  const origin = "https://www.wanmemory.com";
  for (const [referrer, expected] of [
    ["https://www.google.com/search?q=private+query#fragment", "https://www.google.com"],
    ["https://www.google.co.jp/search?q=private", "https://www.google.co.jp"],
    ["https://l.instagram.com/?u=https%3A%2F%2Fexample.com&e=tracking", "https://l.instagram.com"],
    ["https://www.instagram.com/customer-profile/?igsh=private", "https://www.instagram.com"],
    ["https://www.wanmemory.com/auth?access_token=secret#token", "https://www.wanmemory.com/auth"],
    ["https://wanmemory.com/private-dog?token=secret", ""],
    ["https://www.wanmemory.com/admin/orders?order=private", ""],
    ["https://www.wanmemory.com/film/customer?token=secret", ""],
    ["javascript:alert(1)", ""],
    ["", ""],
  ]) assert.equal(config.analyticsReferrer(referrer, origin), expected);
});

test("initial GTM bootstrap applies the same safe referrer before loading any tag", () => {
  const component = readFileSync(new URL("../app/components/GoogleTagManager.tsx", import.meta.url), "utf8");
  const script = component.match(/\{`(\(function[\s\S]*?)`\}/)?.[1].replace("${GOOGLE_TAG_MANAGER_ID}", "GTM-test");
  assert.ok(script);
  for (const [referrer, expected] of [
    ["https://www.google.com/search?q=private", "https://www.google.com"],
    ["https://l.instagram.com/?u=private", "https://l.instagram.com"],
    ["https://www.wanmemory.com/private-dog?order=private", ""],
    ["https://www.wanmemory.com/studio?session_id=secret", "https://www.wanmemory.com/studio"],
  ]) {
    const window = { location: new URL("https://www.wanmemory.com/?utm_source=google&email=private") };
    const document = { referrer, getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }], createElement: () => ({}) };
    vm.runInNewContext(script, { window, document, URL, URLSearchParams, Date });
    const settings = window.dataLayer.find((item) => item[0] === "set")[1];
    assert.equal(settings.page_referrer, expected);
    assert.equal(settings.page_location, "https://www.wanmemory.com/?utm_source=google");
  }
});

test("legacy GTM events and new direct Google tag events have one forwarding path", () => {
  const { window, analytics } = browser();
  analytics.trackEvent("story_view", { starting_step: 1 });
  analytics.trackEvent("proposal_view", { proposal_count: 2 });
  const events = window.dataLayer.filter((item) => item.event);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "story_view");
  const commands = window.dataLayer.filter((item) => item[0] === "event");
  assert.equal(commands.length, 1);
  assert.equal(commands[0][1], "proposal_view");
  assert.equal(commands[0][2].send_to, "G-31J209RFN1");
  assert.equal(commands[0][2].page_location, "https://www.wanmemory.com/studio");
  assert.equal(commands[0][2].page_referrer, "https://www.wanmemory.com/auth");
  assert.doesNotMatch(JSON.stringify(window.dataLayer), /private-order|private-session|secret/);
});

test("purchase is deduplicated and uses JPY yen units, not cents", () => {
  const { window, analytics } = browser();
  for (let index = 0; index < 2; index += 1) analytics.trackOnce("purchase:opaque-transaction", () => analytics.trackCommerceEvent("purchase", { ...config.storybookCommerce(12800), transaction_id: "opaque-transaction" }), true);
  const events = window.dataLayer.filter((item) => item[0] === "event");
  assert.equal(events.length, 1);
  assert.equal(events[0][2].value, 12800);
  assert.equal(events[0][2].items[0].price, 12800);
  assert.equal(events[0][2].currency, "JPY");
});

test("signup requires actual confirmed new account and ignores returning Google login", () => {
  const { window, document, analytics } = browser("/auth");
  const signup = moduleFor("app/lib/signup-analytics.ts", { "./analytics": analytics }, { window, document, localStorage: window.localStorage });
  const now = new Date().toISOString();
  const user = { id: "private-user-id", created_at: now, email_confirmed_at: now };
  signup.rememberSignupAttempt("Google");
  signup.trackConfirmedSignup({ ...user, created_at: "2020-01-01T00:00:00Z" });
  assert.equal(window.dataLayer, undefined);
  signup.rememberSignupAttempt("email");
  signup.trackConfirmedSignup({ ...user, email_confirmed_at: null });
  assert.equal(window.dataLayer, undefined);
  signup.trackConfirmedSignup(user);
  signup.trackConfirmedSignup(user);
  const standard = window.dataLayer.filter((item) => item[0] === "event" && item[1] === "sign_up");
  const legacy = window.dataLayer.filter((item) => item.event === "signup_complete");
  assert.equal(standard.length, 1);
  assert.equal(legacy.length, 1);
  assert.equal(standard[0][2].method, "email");
  assert.doesNotMatch(JSON.stringify(window.dataLayer), /private-user-id/);
});

test("purchase proof rejects unpaid, free, test, mismatched, refunded, missing and historical payments", () => {
  const { verifiedPurchase } = moduleFor("app/lib/purchase-analytics.ts");
  const now = Date.now();
  const order = { payment_status: "paid", quoted_price: 12800, currency: "JPY" };
  const checkout = { stripe_session_id: "cs_live_private", amount: 12800, currency: "jpy", paid_at: new Date(now - 1000).toISOString(), status: "paid", livemode: true };
  const proof = verifiedPurchase(order, checkout, now);
  assert.equal(proof.value, 12800);
  assert.match(proof.transaction_id, /^wm_[0-9a-f]{32}$/);
  assert.equal(verifiedPurchase(order, checkout, now).transaction_id, proof.transaction_id);
  assert.doesNotMatch(JSON.stringify(proof), /cs_live_private/);
  for (const patch of [{ payment_status: "invoice_sent" }, { quoted_price: 0 }, { currency: "USD" }]) assert.equal(verifiedPurchase({ ...order, ...patch }, checkout, now), null);
  for (const patch of [{ livemode: false }, { status: "refunded" }, { amount: 100 }, { currency: "usd" }, { paid_at: null }, { paid_at: new Date(now - 25 * 3600000).toISOString() }]) assert.equal(verifiedPurchase(order, { ...checkout, ...patch }, now), null);
  assert.equal(verifiedPurchase(order, null, now), null);
});

test("read-only purchase verification authenticates and scopes order to owner, never trusts success URL", () => {
  const route = readFileSync(new URL("../app/api/payments/analytics/route.ts", import.meta.url), "utf8");
  assert.match(route, /auth\.getUser/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /\.eq\("status", "paid"\)\.eq\("livemode", true\)/);
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|payment=success|session_id=\{/);
});
