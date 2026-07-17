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
  assert.match(html, /<link rel="canonical" href="https:\/\/kimi-to-no-eiga\.ggutae0\.chatgpt\.site\/"/);
  assert.match(html, /愛犬の思い出動画・メモリアルムービー制作/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"Service"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /<link rel="icon" href="https:\/\/kimi-to-no-eiga\.ggutae0\.chatgpt\.site\/icon/);
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLdMatch, "JSON-LD should be present");
  const structuredData = JSON.parse(jsonLdMatch[1]);
  assert.deepEqual(structuredData.map((entry) => entry["@type"]), ["WebSite", "Organization", "Service", "FAQPage"]);
  assert.equal(structuredData.at(-1).mainEntity.length, 10);
  assert.match(html, /思い出をつくる/);
  assert.match(html, /写真は、残っている/);
  assert.match(html, /A MEMORY BECOMES A FILM/);
  assert.match(html, /ご登録からお届けまで、7つのステップ/);
  assert.match(html, /映画を受け取ったあとも、思い出へ帰れる場所/);
  assert.match(html, /専用メモリーサイトの使い方/);
  assert.match(html, /家族共有URL/);
  assert.match(html, /href="\/auth\?mode=signup&amp;next=\/story"/);
  assert.match(html, /実際の完成イメージを見る/);
  assert.match(html, /画面録画などを技術的に完全に防ぐことはできません/);
  assert.match(html, /メモリーフィルム/);
  assert.match(html, /先着(?:<!-- -->)?10(?:<!-- -->)?組/);
  assert.match(html, /24,800/);
  assert.match(html, /通常価格/);
  assert.match(html, /29,800/);
  assert.match(html, /モニター価格とは何ですか/);
  assert.match(html, /映像コンセプト2案/);
  assert.match(html, /いまを残す思い出フィルム/);
  assert.match(html, /虹の橋メモリアル/);
  assert.match(html, /ありがとう。これからも、思い出の中で一緒に/);
  assert.match(html, /BGM・短い字幕/);
  assert.doesNotMatch(html, /少し先で、待っているね|ナレーション・字幕/);
  assert.match(html, /CUSTOMER SITE DEMO/);
  assert.doesNotMatch(html, /メモリーショート/);
  assert.doesNotMatch(html, /MEMORIAL SIGNATURE|49,800/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("serves crawl controls and an absolute public sitemap", async () => {
  const [robotsResponse, sitemapResponse] = await Promise.all([
    render("/robots.txt"),
    render("/sitemap.xml"),
  ]);
  assert.equal(robotsResponse.status, 200);
  assert.match(robotsResponse.headers.get("content-type") ?? "", /^text\/plain\b/i);
  const robots = await robotsResponse.text();
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: http:\/\/localhost\/sitemap\.xml/);

  assert.equal(sitemapResponse.status, 200);
  assert.match(sitemapResponse.headers.get("content-type") ?? "", /^application\/xml\b/i);
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /<loc>http:\/\/localhost<\/loc>/);
  assert.match(sitemap, /<loc>http:\/\/localhost\/film\/momo-demo<\/loc>/);
  for (const path of ["contact", "terms", "privacy", "legal"]) {
    assert.match(sitemap, new RegExp(`<loc>http:\\/\\/localhost\\/${path}<\\/loc>`));
  }
  assert.doesNotMatch(sitemap, /\/auth|\/story|\/studio|\/admin/);
});

test("server-renders public support and legal pages", async () => {
  const expected = new Map([
    ["/contact", "お問い合わせ"],
    ["/terms", "利用規約"],
    ["/privacy", "プライバシーポリシー"],
    ["/legal", "特定商取引法に基づく表記"],
  ]);
  for (const [path, title] of expected) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} should render`);
    const html = await response.text();
    assert.match(html, new RegExp(title));
    assert.match(html, new RegExp(`<link rel="canonical" href="https:\\/\\/kimi-to-no-eiga\\.ggutae0\\.chatgpt\\.site${path}`));
  }

  const legalResponse = await render("/legal");
  const legalHtml = await legalResponse.text();
  assert.match(legalHtml, /金具泰/);
  assert.match(legalHtml, /〒599-8272 大阪府堺市中区深井中町327-47/);
  assert.match(legalHtml, /080-8530-7568/);
  assert.match(legalHtml, /クレジットカード決済（Stripe）/);
  assert.doesNotMatch(legalHtml, /正式な個人事業者情報.*掲載/);

  const contactResponse = await render("/contact");
  const contactHtml = await contactResponse.text();
  assert.match(contactHtml, /href="tel:08085307568"/);
});

test("keeps private product routes out of search results", async () => {
  for (const path of ["/auth", "/story", "/studio", "/admin", "/film/order-demo", "/memory/share-demo"]) {
    const response = await render(path);
    const html = await response.text();
    assert.match(html, /<meta name="robots" content="noindex, nofollow"\s*\/?\s*>/i, `${path} should be noindex`);
    assert.doesNotMatch(html, /<link rel="canonical"/i, `${path} should not advertise a public canonical URL`);
  }
  const demoResponse = await render("/film/momo-demo");
  const demoHtml = await demoResponse.text();
  assert.doesNotMatch(demoHtml, /<meta name="robots" content="noindex/i);
  assert.match(demoHtml, /<link rel="canonical" href="https:\/\/kimi-to-no-eiga\.ggutae0\.chatgpt\.site\/film\/momo-demo"/);
  assert.match(demoHtml, /<meta property="og:image" content="https:\/\/kimi-to-no-eiga\.ggutae0\.chatgpt\.site\/og\.png"/);
});

test("server-renders the connected MVP routes", async () => {
  for (const path of ["/auth", "/story", "/studio", "/admin", "/film/order-demo", "/film/momo-demo", "/memory/share-demo"]) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} should render`);
  }
});

test("memory sharing keeps family links private and album access scoped", async () => {
  const { readFile } = await import("node:fs/promises");
  const [manager, sharedPage, migration] = await Promise.all([
    readFile(new URL("app/studio/MemoryShareManager.tsx", root), "utf8"),
    readFile(new URL("app/memory/[token]/SharedMemorySite.tsx", root), "utf8"),
    readFile(new URL("supabase/migrations/202607170001_memory_sharing.sql", root), "utf8"),
  ]);
  assert.match(manager, /家族はログインせずに閲覧できます/);
  assert.match(manager, /LINEなどで共有/);
  assert.match(manager, /30枚まで/);
  assert.match(sharedPage, /get_shared_memory/);
  assert.match(sharedPage, /createSignedUrls\(paths, 900\)/);
  assert.match(migration, /manage_memory_share/);
  assert.match(migration, /order_assets_public_shared_select/);
  assert.match(migration, /where share_links\.token = p_token/);
});

test("renders the customer memory site demo", async () => {
  const response = await render("/film/momo-demo");
  const html = await response.text();
  assert.match(html, /モモと歩いた季節/);
  assert.match(html, /CUSTOMER DEMO/);
  assert.match(html, /WHEN A MEMORY RETURNS/);
  assert.match(html, /あの日の光まで戻ってくる/);
  assert.match(html, /家族専用メモリーサイトの完成イメージ/);
  assert.match(html, /閲覧専用 · ダウンロード非対応/);
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

test("signup stores the dog name and the story form reuses it", async () => {
  const { readFile } = await import("node:fs/promises");
  const [authPanel, storyWizard, migration] = await Promise.all([
    readFile(new URL("app/auth/AuthPanel.tsx", root), "utf8"),
    readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
    readFile(new URL("supabase/migrations/202607160002_profile_pet_name.sql", root), "utf8"),
  ]);
  assert.match(authPanel, /愛犬のお名前/);
  assert.match(authPanel, /pet_name: petName\.trim\(\)/);
  assert.match(authPanel, /requestedMode\(searchParams\.get\("mode"\)\)/);
  assert.match(storyWizard, /profile\?\.primary_pet_name/);
  assert.match(storyWizard, /petName: parsed\.petName\?\.trim\(\) \|\| preferredPetName/);
  assert.match(storyWizard, /\/auth\?mode=signup&next=\/story/);
  assert.match(storyWizard, /映像はBGMと短い字幕を中心に/);
  assert.doesNotMatch(storyWizard, /<span>ナレーション<\/span>/);
  assert.match(storyWizard, /const missingFields = useMemo<MissingField\[\]>/);
  assert.match(storyWizard, /photoFiles\.length === 0/);
  assert.match(storyWizard, /未入力\$\{missingFields\.length\}項目を確認する/);
  assert.match(storyWizard, /onClick=\{\(\) => goToStep\(item\.step\)\}/);
  assert.doesNotMatch(storyWizard, /if \(step === 1 &&/);
  assert.match(migration, /add column if not exists primary_pet_name text/);
});

test("concept selection requires an explicit send and stays editable before production", async () => {
  const { readFile } = await import("node:fs/promises");
  const [studio, css, migration] = await Promise.all([
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("supabase/migrations/202607160001_mvp.sql", root), "utf8"),
  ]);
  assert.match(studio, /setPendingConceptSlot\(concept\.slot\)/);
  assert.match(studio, /この案で制作希望を送る/);
  assert.match(studio, /concept-receipt-dialog/);
  assert.match(studio, /コンセプトをお預かりしました/);
  assert.match(studio, /映像制作へ進む前なら、何度でも変更できます/);
  assert.doesNotMatch(studio, /onClick=\{\(\) => selectConcept\(concept\.slot\)\}/);
  assert.match(css, /\.concept-receipt-backdrop/);
  assert.match(migration, /status in \('concepts_ready', 'concept_selected'\)/);
});

test("includes mobile breathing room, sticky conversion action, and touch story snapping", async () => {
  const { readFile } = await import("node:fs/promises");
  const [css, page, story] = await Promise.all([
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/components/ScrollMemoryStory.tsx", root), "utf8"),
  ]);
  assert.match(css, /\.shell \{ width: calc\(100% - 40px\); \}/);
  assert.match(css, /\.mobile-sticky-cta\.visible/);
  assert.match(css, /focus-visible/);
  assert.match(page, /MobileStickyCta/);
  assert.match(story, /touchstart/);
  assert.match(story, /moveToChapter\(next\)/);
});
