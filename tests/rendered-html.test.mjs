import assert from "node:assert/strict";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Japanese landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ja">/i);
  assert.match(html, /一緒に過ごした時間を/);
  assert.match(html, /WAN MEMORY/);
  assert.match(html, /思い出をつくる/);
  assert.match(html, /写真は、残っている/);
  assert.match(html, /A MEMORY BECOMES A FILM/);
  assert.match(html, /完成まで、迷わない4つのステップ/);
  assert.match(html, /一頭ごとの、専用メモリーウェブサイト/);
  assert.match(html, /メモリーフィルム/);
  assert.match(html, /映像コンセプト2案/);
  assert.match(html, /いまを残す思い出フィルム/);
  assert.match(html, /虹の橋メモリアル/);
  assert.match(html, /少し先で、待っているね/);
  assert.match(html, /CUSTOMER SITE DEMO/);
  assert.doesNotMatch(html, /メモリーショート/);
  assert.doesNotMatch(html, /MEMORIAL SIGNATURE|49,800/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("server-renders the first-MVP routes", async () => {
  for (const path of ["/story", "/studio", "/film/momo-demo"]) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} should render`);
  }
});

test("renders the customer memory site demo", async () => {
  const response = await render("/film/momo-demo");
  const html = await response.text();
  assert.match(html, /モモと歩いた季節/);
  assert.match(html, /CUSTOMER DEMO/);
  assert.match(html, /WHEN A MEMORY RETURNS/);
  assert.match(html, /あの日の光まで戻ってくる/);
  assert.match(html, /お客様専用メモリーサイトの完成イメージ/);
});

test("starter preview was removed", async () => {
  const { access, readFile } = await import("node:fs/promises");
  await assert.rejects(access(new URL("app/_sites-preview/", root)));
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|next\/font\/google/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
