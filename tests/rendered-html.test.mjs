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
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.wanmemory\.com\/"/);
  assert.match(html, /愛犬の思い出動画・メモリアルムービー制作/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"Service"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /<link rel="icon" href="https:\/\/www\.wanmemory\.com\/icon/);
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLdMatch, "JSON-LD should be present");
  const structuredData = JSON.parse(jsonLdMatch[1]);
  assert.deepEqual(structuredData.map((entry) => entry["@type"]), ["WebSite", "Organization", "Service", "FAQPage"]);
  assert.equal(structuredData.at(-1).mainEntity.length, 13);
  assert.doesNotMatch(html, /現在、正式公開に向けて準備中です/);
  assert.doesNotMatch(html, /お申し込み受付は準備中/);
  assert.match(html, /写真は、残っている/);
  assert.match(html, /A MEMORY BECOMES A FILM/);
  assert.match(html, /ご登録からお届けまで、7つのステップ/);
  assert.match(html, /映画を受け取ったあとも、思い出へ帰れる場所/);
  assert.match(html, /専用メモリーサイトの使い方/);
  assert.match(html, /専用メモリーサイト/);
  assert.doesNotMatch(html, /家族共有URL|家族へ共有する|ご家族にはログイン不要/);
  assert.match(html, /href="\/auth\?mode=signup&amp;next=\/story"/);
  assert.match(html, /実際の完成イメージを見る/);
  assert.match(html, /画面録画などを技術的に完全に防ぐことはできません/);
  assert.match(html, /メモリーフィルム/);
  assert.match(html, /初期(?:<!-- -->)?10(?:<!-- -->)?組/);
  assert.match(html, /24,800/);
  assert.match(html, /通常価格/);
  assert.match(html, /29,800/);
  assert.match(html, /モニター価格とは何ですか/);
  assert.match(html, /人と一緒に写った写真も提出できますか/);
  assert.match(html, /人物のお顔をAIで生成・再現する制作は、現在行っていません/);
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
    assert.match(html, new RegExp(`<link rel="canonical" href="https:\\/\\/www\\.wanmemory\\.com${path}`));
  }

  const legalResponse = await render("/legal");
  const legalHtml = await legalResponse.text();
  assert.match(legalHtml, /金具泰/);
  assert.match(legalHtml, /〒599-8272 大阪府堺市中区深井中町327-47/);
  assert.match(legalHtml, /お申し込みの意思決定に先立って遅滞なく開示/);
  assert.doesNotMatch(legalHtml, /href="tel:/);
  assert.match(legalHtml, /クレジットカード決済（Stripe）/);
  assert.doesNotMatch(legalHtml, /正式な個人事業者情報.*掲載/);

  const contactResponse = await render("/contact");
  const contactHtml = await contactResponse.text();
  assert.match(contactHtml, /info@wanmemory\.com/);
  assert.match(contactHtml, /mailto:info@wanmemory\.com/);
  assert.doesNotMatch(contactHtml, /ggutae0@gmail\.com/);
  assert.match(contactHtml, /電話番号の開示をご希望の方/);
  assert.match(contactHtml, /メールで開示を請求する/);
  assert.doesNotMatch(contactHtml, /href="tel:/);
});

test("keeps private product routes out of search results", async () => {
  for (const path of ["/auth", "/story", "/studio", "/admin", "/film/order-demo"]) {
    const response = await render(path);
    const html = await response.text();
    assert.match(html, /<meta name="robots" content="noindex, nofollow"\s*\/?\s*>/i, `${path} should be noindex`);
    assert.doesNotMatch(html, /<link rel="canonical"/i, `${path} should not advertise a public canonical URL`);
  }
  const memoryResponse = await render("/memory/share-demo");
  const memoryHtml = await memoryResponse.text();
  assert.match(memoryHtml, /<meta name="robots" content="noindex, follow"\s*\/?\s*>/i);
  assert.doesNotMatch(memoryHtml, /<meta name="robots" content="[^"]*nofollow/i);
  assert.doesNotMatch(memoryHtml, /<link rel="canonical"/i);
  assert.match(memoryHtml, /<meta property="og:title" content="専用メモリーサイト"/i);
  assert.match(memoryHtml, /<meta property="og:image" content="https:\/\/www\.wanmemory\.com\/api\/memory\/share-demo\/og"/i);
  const demoResponse = await render("/film/momo-demo");
  const demoHtml = await demoResponse.text();
  assert.doesNotMatch(demoHtml, /<meta name="robots" content="noindex/i);
  assert.match(demoHtml, /<link rel="canonical" href="https:\/\/www\.wanmemory\.com\/film\/momo-demo"/);
  assert.match(demoHtml, /<meta property="og:image" content="https:\/\/www\.wanmemory\.com\/og\.png"/);
});

test("server-renders the connected MVP routes", async () => {
  for (const path of ["/auth", "/story", "/studio", "/admin", "/film/order-demo", "/film/momo-demo", "/memory/share-demo"]) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} should render`);
  }
});

test("memory sharing keeps family links private and album access scoped", async () => {
  const { readFile } = await import("node:fs/promises");
  const [manager, sharedPage, metadataPage, publicMemory, socialImage, migration] = await Promise.all([
    readFile(new URL("app/studio/MemoryShareManager.tsx", root), "utf8"),
    readFile(new URL("app/memory/[token]/SharedMemorySite.tsx", root), "utf8"),
    readFile(new URL("app/memory/[token]/page.tsx", root), "utf8"),
    readFile(new URL("app/lib/supabase/public-memory.ts", root), "utf8"),
    readFile(new URL("app/api/memory/[token]/og/route.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202607170001_memory_sharing.sql", root), "utf8"),
  ]);
  assert.match(manager, /家族はログインせずに閲覧できます/);
  assert.match(manager, /LINEなどで共有/);
  assert.match(manager, /\$\{order\.pet_name\}との思い出｜WAN MEMORY/);
  assert.match(manager, /30枚まで/);
  assert.match(sharedPage, /get_shared_memory/);
  assert.match(sharedPage, /createSignedUrls\(paths, 900\)/);
  assert.match(sharedPage, /PRIVATE MEMORY SITE/);
  assert.doesNotMatch(sharedPage, /家族共有ページ|FAMILY MEMORY SITE/);
  assert.match(metadataPage, /generateMetadata/);
  assert.match(metadataPage, /follow: true/);
  assert.match(metadataPage, /\$\{memory\.order\.pet_name\}との思い出/);
  assert.match(metadataPage, /\/api\/memory\/\$\{encodeURIComponent\(token\)\}\/og/);
  assert.match(publicMemory, /get_shared_memory/);
  assert.match(publicMemory, /createSignedUrl\(path, 90\)/);
  assert.match(socialImage, /Content-Type/);
  assert.match(socialImage, /X-Robots-Tag/);
  assert.match(migration, /manage_memory_share/);
  assert.match(migration, /order_assets_public_shared_select/);
  assert.match(migration, /where share_links\.token = p_token/);
});

test("uses the default social image when a memory URL is unavailable", async () => {
  const response = await render("/api/memory/share-demo/og");
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/og.png");
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
  assert.match(storyWizard, /totalPhotoCount < MIN_TOTAL_PHOTOS/);
  assert.match(storyWizard, /memoryPhotoFiles\[memory\.clientKey\]/);
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

test("keeps customer and admin work practical and safe on mobile", async () => {
  const { readFile } = await import("node:fs/promises");
  const [css, studio, admin] = await Promise.all([
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
  ]);
  assert.match(css, /\.studio-next-action/);
  assert.match(css, /\.mobile-concept-submit/);
  assert.match(css, /\.mobile-studio-timeline/);
  assert.match(css, /\.form-grid input, \.form-grid select, \.stacked-fields textarea \{ font-size: 16px; \}/);
  assert.match(css, /\.album-manager-actions button \{ min-height: 44px;/);
  assert.match(css, /\.admin-mobile-sections/);
  assert.match(studio, /NEXT ACTION · 今やること/);
  assert.match(studio, /hasPendingConceptChange/);
  assert.match(studio, /id="materials"/);
  assert.match(studio, /id="delivery"/);
  assert.match(studio, /id="review-video"/);
  assert.match(admin, /まだ納品されていません/);
  assert.match(admin, /お客様名・ファイル名・用途を確認しました/);
  assert.match(admin, /disabled=\{saving \|\| !videoChecked/);
  assert.match(admin, /onChange=\{selectVideo\}/);
  assert.match(admin, /id="admin-photos"/);
  assert.match(admin, /admin_resolve_revision/);
  assert.match(admin, /admin_resolve_message/);
  assert.match(admin, /admin_register_video_asset/);
  assert.doesNotMatch(admin, /onChange=\{uploadFinalVideo\}/);
});

test("enforces operational workflow rules in the database boundary", async () => {
  const { readFile } = await import("node:fs/promises");
  const [migration, lockdown, story, studio, admin] = await Promise.all([
    readFile(new URL("supabase/migrations/202607210001_operations_hardening.sql", root), "utf8"),
    readFile(new URL("supabase/post_deploy/operations_lockdown_after_admin_deploy.sql", root), "utf8"),
    readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
  ]);
  assert.match(migration, /at least 5 source images are required/);
  assert.match(migration, /revision_used >= v_order\.revision_limit/);
  assert.match(migration, /status not in \('awaiting_materials', 'cancelled'\)/);
  assert.match(migration, /create or replace function public\.admin_update_order/);
  assert.match(migration, /create or replace function public\.admin_register_video_asset/);
  assert.match(migration, /'review_video'/);
  assert.match(migration, /insert into public\.order_events/);
  assert.match(lockdown, /drop policy if exists orders_admin_update/);
  assert.match(story, /totalPhotoCount < MIN_TOTAL_PHOTOS/);
  assert.match(story, /beforeunload/);
  assert.match(story, /写真をもう一度選んでください/);
  assert.match(studio, /revisionsRemaining/);
  assert.match(admin, /rpc\("admin_update_order"/);
  assert.doesNotMatch(admin, /from\("orders"\)\.update/);
});

test("blocks launch-critical skips and records consent and customer approval", async () => {
  const { readFile } = await import("node:fs/promises");
  const [release, marker, story, studio, admin, cron, readme] = await Promise.all([
    readFile(new URL("supabase/migrations/202607210003_release_readiness.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/202607210002_operations_lockdown.sql", root), "utf8"),
    readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
    readFile(new URL("app/api/cron/cleanup-drafts/route.ts", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
  ]);
  assert.match(release, /customer_approved_at/);
  assert.match(release, /create or replace function public\.customer_approve_review/);
  assert.match(release, /open revision must be resolved before delivery/);
  assert.match(release, /payment must be confirmed before production/);
  assert.match(release, /current consent record required before video production/);
  assert.match(release, /age required/);
  assert.match(release, /personality required/);
  assert.match(release, /favorite memory required/);
  assert.match(release, /message to pet required/);
  assert.match(release, /create or replace function public\.bootstrap_first_admin/);
  assert.doesNotMatch(release, /\('customer_review', 'quality_check'\)/);
  assert.doesNotMatch(marker, /drop policy if exists orders_admin_update/);
  assert.match(marker, /post_deploy\/operations_lockdown_after_admin_deploy\.sql/);
  assert.match(story, /externalAiConsent/);
  assert.match(story, /p_ai_notice_version|ai_notice_version/);
  assert.match(studio, /customer_approve_review/);
  assert.match(studio, /この映像で確定する/);
  assert.match(studio, /readOnlyPreview/);
  assert.match(admin, /未対応あり/);
  assert.match(admin, /この映像で納品を再試行/);
  assert.match(admin, /order\.customer_approved_at/);
  assert.match(cron, /Bearer \$\{cronSecret\}/);
  assert.match(cron, /expire_memory_order_draft/);
  assert.match(readme, /bootstrap_first_admin/);
  assert.match(readme, /supabase\/post_deploy\/operations_lockdown_after_admin_deploy\.sql/);
});

test("records and enforces people, minor, photo-rights and external-service consent", async () => {
  const { readFile } = await import("node:fs/promises");
  const [peopleConsent, story, studio, admin, privacy] = await Promise.all([
    readFile(new URL("supabase/migrations/202607210004_people_photo_consent.sql", root), "utf8"),
    readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
    readFile(new URL("app/privacy/page.tsx", root), "utf8"),
  ]);
  assert.match(peopleConsent, /contains_people boolean/);
  assert.match(peopleConsent, /photo_rights_consented_at/);
  assert.match(peopleConsent, /depicted_people_consented_at/);
  assert.match(peopleConsent, /minor_guardian_consented_at/);
  assert.match(peopleConsent, /enforce_current_order_consents_trigger/);
  assert.match(peopleConsent, /current photo, people, minor and external service consent records are required before video processing/);
  assert.match(story, /その思い出と同じ場面の、見やすい写真を選んでください/);
  assert.match(story, /現在のWAN MEMORYでは、人物のお顔をAIで生成・再現する制作は行っていません/);
  assert.match(story, /photo_rights_consent_accepted/);
  assert.match(studio, /p_people_policy_version/);
  assert.match(admin, /人物の取り扱い/);
  assert.match(admin, /未成年者の保護者同意/);
  assert.match(privacy, /人物が写っている写真の取り扱い/);
  assert.match(privacy, /外部サービスでのデータの取り扱い/);
  assert.doesNotMatch(story, /広告利用や当社のAI学習には使用しません/);
});

test("stores guided memory entries with one to three matching photos", async () => {
  const { readFile } = await import("node:fs/promises");
  const [migration, story, uploads, admin, studio, css] = await Promise.all([
    readFile(new URL("supabase/migrations/202607210005_memory_entries.sql", root), "utf8"),
    readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
    readFile(new URL("app/lib/supabase/uploads.ts", root), "utf8"),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(migration, /create table if not exists public\.order_memories/);
  assert.match(migration, /add column if not exists memory_id uuid/);
  assert.match(migration, /each memory requires 1 to 3 photos/);
  assert.match(migration, /between 2 and 6 memory entries are required/);
  assert.match(migration, /at least 5 memory photos are required/);
  assert.match(story, /別の思い出を追加する/);
  assert.match(story, /その子の表情や動き/);
  assert.match(story, /写真に写っている場面と結びつくように/);
  assert.match(story, /save_order_memory_entry/);
  assert.match(story, /slice\(0, 3\)/);
  assert.match(uploads, /memory_id: memoryId/);
  assert.match(admin, /制作用JSONをコピー/);
  assert.match(admin, /内容と写真が同じ場面か/);
  assert.match(studio, /studio-memory-list/);
  assert.match(css, /\.memory-entry-card/);
});

test("keeps Vercel and Sites build outputs separate", async () => {
  const { readFile } = await import("node:fs/promises");
  const [packageSource, vercelSource] = await Promise.all([
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("vercel.json", root), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);
  const vercel = JSON.parse(vercelSource);
  assert.equal(packageJson.engines.node, "22.x");
  assert.equal(packageJson.scripts["build:sites"], "WRANGLER_LOG_PATH=.wrangler/wrangler.log vinext build");
  assert.equal(packageJson.scripts["build:vercel"], "next build");
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.buildCommand, "npm run build:vercel");
  assert.equal(vercel.outputDirectory, ".next");
  assert.equal(vercel.crons[0].path, "/api/cron/cleanup-drafts");
});

test("loads Vercel Web Analytics from the root layout", async () => {
  const { readFile } = await import("node:fs/promises");
  const [layout, packageSource] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(layout, /from "@vercel\/analytics\/next"/);
  assert.match(layout, /<Analytics \/>/);
  assert.ok(JSON.parse(packageSource).dependencies["@vercel/analytics"]);
});
