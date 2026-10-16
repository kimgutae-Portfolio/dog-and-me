import assert from "node:assert/strict";
import test from "node:test";

// Run after `npm run build`; these checks inspect the actual server-rendered UI.
async function render(path) {
  const { default: worker } = await import("../dist/server/index.js");
  const response = await worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  return response.text();
}

test("Moka offers the complete film before the five storybook pages", async () => {
  const html = await render("/film/moka-demo");
  const film = html.indexOf('id="complete-film"');
  const pages = html.indexOf('id="storybook-pages"');
  assert.ok(film >= 0 && pages > film, "the film must precede the page gallery");
  assert.match(html, /href="#complete-film"/);
  assert.match(html, /01 \/ COMPLETE FILM/);
  assert.match(html, /02 \/ STORYBOOK PAGES/);
  assert.equal((html.match(/class="moka-storybook-page-image"/g) ?? []).length, 5);
  const player = html.match(/<video\b[^>]*>/)?.[0] ?? "";
  assert.match(player, /\bcontrols(?:="")?/);
  assert.doesNotMatch(player, /\bautoplay\b/i, "the sample must not start with unexpected sound");
});

test("home shows three steps and preserves the seven-step detail as an optional disclosure", async () => {
  const html = await render("/");
  const overview = html.match(/<ol\b[^>]*class="process-list process-overview"[^>]*>([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(overview);
  assert.equal((overview.match(/<li\b/g) ?? []).length, 3);
  const details = html.match(/<details\b([^>]*class="process-details"[^>]*)>([\s\S]*?)<\/details>/);
  assert.ok(details);
  assert.doesNotMatch(details[1], /\bopen(?:\s|=|$)/, "detailed production steps should start collapsed");
  assert.match(details[2], /<summary>/);
  assert.equal((details[2].match(/<li\b/g) ?? []).length, 7);
  assert.match(details[2], /合計2場面まで修正/);
  assert.match(details[2], /合計1場面まで修正/);
});

test("consultation CTAs explain registration instead of promising an instant preview", async () => {
  const home = await render("/");
  assert.match(home, /うちの子の制作相談を始める/);
  assert.match(home, /制作相談を始める/);
  assert.match(home, /お名前 → 無料登録 → 写真と思い出を入力/);
  assert.doesNotMatch(home, /うちの子で試してみる|このプランで相談する|物語とホームページをつくる/);
  const start = await render("/start");
  assert.match(start, /お名前 → 無料登録 → 写真と思い出を入力/);
  assert.match(start, /無料登録へ進む/);
  assert.match(start, /ここではまだ注文・決済されません/);
});

test("purchase verification rejects unauthenticated requests without exposing payment data", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const response = await worker.fetch(
    new Request("http://localhost/api/payments/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "00000000-0000-4000-8000-000000000001" }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 401);
  assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});
