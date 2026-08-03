import assert from "node:assert/strict";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Japanese landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ja">/i);
  assert.match(html, /うちの子が主人公になる/);
  assert.match(html, /WAN MEMORY/);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/www\.wanmemory\.com\/"/,
  );
  assert.match(html, /愛犬が主人公になる、動く絵本制作/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"Service"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(
    html,
    /<link rel="icon" href="https:\/\/www\.wanmemory\.com\/icon/,
  );
  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(jsonLdMatch, "JSON-LD should be present");
  const structuredData = JSON.parse(jsonLdMatch[1]);
  assert.deepEqual(
    structuredData.map((entry) => entry["@type"]),
    ["WebSite", "Organization", "Service", "FAQPage"],
  );
  assert.equal(
    structuredData.find((entry) => entry["@type"] === "Service").offers
      .availability,
    "https://schema.org/InStock",
  );
  assert.equal(structuredData.at(-1).mainEntity.length, 10);
  assert.doesNotMatch(html, /現在、正式公開に向けて準備中です/);
  assert.match(html, /物語をつくる/);
  assert.match(html, /href="\/auth\?mode=signup&amp;next=\/story"/);
  assert.match(html, /写真を再現するのではなく/);
  assert.match(html, /水彩・ガッシュ/);
  assert.match(html, /一枚の花びらが/);
  assert.match(html, /二つの物語案/);
  assert.match(html, /専用ページで受け取る/);
  assert.match(html, /専用ものがたりサイト/);
  assert.doesNotMatch(
    html,
    /家族共有URL|家族へ共有する|ご家族にはログイン不要/,
  );
  assert.match(html, /動くページを見る/);
  assert.match(html, /ミルのテストストーリー/);
  assert.match(html, /動く絵本/);
  assert.match(html, /初期(?:<!-- -->)?10(?:<!-- -->)?組/);
  assert.match(html, /24,800/);
  assert.match(html, /通常価格/);
  assert.match(html, /29,800/);
  assert.match(html, /税込/);
  assert.match(html, /モニター価格とは何ですか/);
  assert.match(html, /人が写っている写真も送れますか/);
  assert.match(html, /人物のお顔は新しく生成せず/);
  assert.match(html, /物語案2案/);
  assert.match(html, /うちの子の動く絵本/);
  assert.doesNotMatch(
    html,
    /虹の橋|メモリアル|Gentle memorial|先に旅立|空へ続く/,
  );
  assert.match(html, /BGM・場面ごとの物語字幕/);
  assert.doesNotMatch(html, /少し先で、待っているね|ナレーション・字幕/);
  assert.match(html, /MIRU AND A PETAL OF SPRING/);
  assert.doesNotMatch(html, /メモリーショート/);
  assert.doesNotMatch(html, /MEMORIAL SIGNATURE|49,800/);
  assert.doesNotMatch(
    html,
    /codex-preview|react-loading-skeleton|Your site is taking shape/,
  );
});

test("serves crawl controls and an absolute public sitemap", async () => {
  const [robotsResponse, sitemapResponse] = await Promise.all([
    render("/robots.txt"),
    render("/sitemap.xml"),
  ]);
  assert.equal(robotsResponse.status, 200);
  assert.match(
    robotsResponse.headers.get("content-type") ?? "",
    /^text\/plain\b/i,
  );
  const robots = await robotsResponse.text();
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: http:\/\/localhost\/sitemap\.xml/);

  assert.equal(sitemapResponse.status, 200);
  assert.match(
    sitemapResponse.headers.get("content-type") ?? "",
    /^application\/xml\b/i,
  );
  const sitemap = await sitemapResponse.text();
  assert.match(sitemap, /<loc>http:\/\/localhost<\/loc>/);
  assert.match(sitemap, /<loc>http:\/\/localhost\/film\/miru-demo<\/loc>/);
  for (const path of ["contact", "terms", "privacy", "legal"]) {
    assert.match(
      sitemap,
      new RegExp(`<loc>http:\\/\\/localhost\\/${path}<\\/loc>`),
    );
  }
  for (const path of [
    "aiken-omoide-douga",
    "uchinoko-kinenbi-douga",
    "dog-photo-guide",
  ]) {
    assert.match(
      sitemap,
      new RegExp(`<loc>http:\\/\\/localhost\\/${path}<\\/loc>`),
    );
  }
  assert.doesNotMatch(sitemap, /\/auth|\/story|\/studio|\/admin/);
});

test("renders focused Japanese SEO guide pages", async () => {
  const expected = new Map([
    [
      "/aiken-omoide-douga",
      ["愛犬の写真から、一冊のような物語を", "愛犬の写真からつくる動く絵本"],
    ],
    [
      "/uchinoko-kinenbi-douga",
      ["家族になった日を、物語のはじまりに", "うちの子記念日を動く絵本に"],
    ],
    [
      "/dog-photo-guide",
      ["物語ひとつに、その日の一枚を", "愛犬の動く絵本に使う写真の選び方"],
    ],
  ]);

  for (const [path, [heading, metadataTitle]] of expected) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} should render`);
    const html = await response.text();
    assert.match(html, new RegExp(heading));
    assert.match(html, new RegExp(metadataTitle));
    assert.match(
      html,
      new RegExp(
        `<link rel="canonical" href="https:\\/\\/www\\.wanmemory\\.com${path}`,
      ),
    );
    assert.match(html, /"@type":"WebPage"/);
    assert.match(html, /"@type":"BreadcrumbList"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.doesNotMatch(html, /<meta name="robots" content="noindex/i);
  }
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
    assert.match(
      html,
      new RegExp(
        `<link rel="canonical" href="https:\\/\\/www\\.wanmemory\\.com${path}`,
      ),
    );
  }

  const legalResponse = await render("/legal");
  const legalHtml = await legalResponse.text();
  assert.match(legalHtml, /<dt>販売事業者<\/dt><dd>金具泰<\/dd>/);
  assert.match(legalHtml, /<dt>屋号<\/dt><dd>WAN MEMORY<\/dd>/);
  assert.doesNotMatch(legalHtml, /〒\d{3}-\d{4}/);
  assert.doesNotMatch(legalHtml, /href="tel:/);
  assert.match(
    legalHtml,
    /お申し込みの意思決定に先立って遅滞なく電子メールで開示/,
  );
  assert.match(legalHtml, /相談フォームの送信だけでは料金は発生しません/);
  assert.match(legalHtml, /クレジットカード決済（Stripe）/);
  assert.match(legalHtml, /決済後、制作着手前.*全額返金/);
  assert.match(legalHtml, /通常10〜14営業日/);

  const contactResponse = await render("/contact");
  const contactHtml = await contactResponse.text();
  assert.match(contactHtml, /info@wanmemory\.com/);
  assert.match(contactHtml, /mailto:info@wanmemory\.com/);
  assert.doesNotMatch(contactHtml, /ggutae0@gmail\.com/);
  assert.doesNotMatch(contactHtml, /href="tel:/);
  assert.match(contactHtml, /運営：/);
  assert.match(contactHtml, /金具泰/);
  assert.match(contactHtml, /屋号：/);

  const privacyResponse = await render("/privacy");
  const privacyHtml = await privacyResponse.text();
  assert.match(privacyHtml, /カード決済にはStripeを利用/);
  assert.match(privacyHtml, /WAN MEMORYのサーバーには保存されません/);
});

test("keeps private product routes out of search results", async () => {
  for (const path of [
    "/auth",
    "/story",
    "/studio",
    "/admin",
    "/film/order-demo",
  ]) {
    const response = await render(path);
    const html = await response.text();
    assert.match(
      html,
      /<meta name="robots" content="noindex, nofollow"\s*\/?\s*>/i,
      `${path} should be noindex`,
    );
    assert.doesNotMatch(
      html,
      /<link rel="canonical"/i,
      `${path} should not advertise a public canonical URL`,
    );
  }
  const memoryResponse = await render("/memory/share-demo");
  const memoryHtml = await memoryResponse.text();
  assert.match(
    memoryHtml,
    /<meta name="robots" content="noindex, follow"\s*\/?\s*>/i,
  );
  assert.doesNotMatch(
    memoryHtml,
    /<meta name="robots" content="[^"]*nofollow/i,
  );
  assert.doesNotMatch(memoryHtml, /<link rel="canonical"/i);
  assert.match(
    memoryHtml,
    /<meta property="og:title" content="専用ものがたりサイト"/i,
  );
  assert.match(
    memoryHtml,
    /<meta property="og:image" content="https:\/\/www\.wanmemory\.com\/api\/memory\/share-demo\/og"/i,
  );
  const demoResponse = await render("/film/miru-demo");
  const demoHtml = await demoResponse.text();
  assert.doesNotMatch(demoHtml, /<meta name="robots" content="noindex/i);
  assert.match(
    demoHtml,
    /<link rel="canonical" href="https:\/\/www\.wanmemory\.com\/film\/miru-demo"/,
  );
  assert.match(
    demoHtml,
    /<meta property="og:image" content="https:\/\/www\.wanmemory\.com\/og\.png"/,
  );
});

test("server-renders the connected MVP routes", async () => {
  for (const path of [
    "/auth",
    "/story",
    "/studio",
    "/admin",
    "/film/order-demo",
    "/film/miru-demo",
    "/memory/share-demo",
  ]) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} should render`);
  }
});

test("memory sharing keeps family links private and album access scoped", async () => {
  const { readFile } = await import("node:fs/promises");
  const [
    manager,
    sharedPage,
    metadataPage,
    publicMemory,
    socialImage,
    migration,
  ] = await Promise.all([
    readFile(new URL("app/studio/MemoryShareManager.tsx", root), "utf8"),
    readFile(
      new URL("app/memory/[shareId]/SharedMemorySite.tsx", root),
      "utf8",
    ),
    readFile(new URL("app/memory/[shareId]/page.tsx", root), "utf8"),
    readFile(new URL("app/lib/supabase/public-memory.ts", root), "utf8"),
    readFile(new URL("app/api/memory/[shareId]/og/route.ts", root), "utf8"),
    readFile(
      new URL("supabase/migrations/202607170001_memory_sharing.sql", root),
      "utf8",
    ),
  ]);
  assert.match(manager, /家族はログインせずに閲覧できます/);
  assert.match(manager, /LINEなどで共有/);
  assert.match(manager, /\$\{order\.pet_name\}との思い出｜WAN MEMORY/);
  assert.match(manager, /30枚まで/);
  assert.match(sharedPage, /get_shared_memory/);
  assert.match(sharedPage, /createSignedUrls\(paths, 900\)/);
  assert.match(sharedPage, /PRIVATE STORYBOOK SITE/);
  assert.doesNotMatch(sharedPage, /家族共有ページ|FAMILY MEMORY SITE/);
  assert.match(metadataPage, /generateMetadata/);
  assert.match(metadataPage, /follow: true/);
  assert.match(metadataPage, /\$\{memory\.order\.pet_name\}の動く絵本/);
  assert.match(
    metadataPage,
    /\/api\/memory\/\$\{encodeURIComponent\(shareId\)\}\/og/,
  );
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

test("renders the moving storybook demo", async () => {
  const response = await render("/film/miru-demo");
  const html = await response.text();
  assert.match(html, /ミルと、ひとひらの春/);
  assert.match(html, /STORYBOOK SAMPLE/);
  assert.match(html, /A PAGE COMES ALIVE/);
  assert.match(html, /春風から届いた手紙/);
  assert.match(html, /ひとひらが/);
  assert.match(html, /5秒の制作テスト/);
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
  const [authPanel, storyWizard, migration, startStoryLink] = await Promise.all(
    [
      readFile(new URL("app/auth/AuthPanel.tsx", root), "utf8"),
      readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
      readFile(
        new URL("supabase/migrations/202607160002_profile_pet_name.sql", root),
        "utf8",
      ),
      readFile(new URL("app/components/StartStoryLink.tsx", root), "utf8"),
    ],
  );
  assert.match(authPanel, /愛犬のお名前/);
  assert.match(authPanel, /pet_name: petName\.trim\(\)/);
  assert.match(authPanel, /requestedMode\(searchParams\.get\("mode"\)\)/);
  assert.match(
    authPanel,
    /loading \|\| \(user && !searchParams\.get\("confirmed"\)\)/,
  );
  assert.match(authPanel, /setSignupConfirmationEmail\(email\.trim\(\)\)/);
  assert.match(authPanel, /role="alertdialog"/);
  assert.match(authPanel, /確認メールを送信しました。/);
  assert.match(authPanel, /メールアドレスを確認/);
  assert.match(startStoryLink, /user \? "\/story" : START_STORY_HREF/);
  assert.match(startStoryLink, /if \(!loading\) return/);
  assert.match(storyWizard, /profile\?\.primary_pet_name/);
  assert.match(
    storyWizard,
    /petName: parsed\.petName\?\.trim\(\) \|\| preferredPetName/,
  );
  assert.match(storyWizard, /\/auth\?mode=signup&next=\/story/);
  assert.match(storyWizard, /const FIXED_BGM = "物語に合わせておまかせ"/);
  assert.match(
    storyWizard,
    /const FIXED_FILM_PURPOSE: FilmPurpose = "いまを残す"/,
  );
  assert.match(
    storyWizard,
    /const steps = \["愛犬のこと", "物語と写真", "確認"\]/,
  );
  assert.match(storyWizard, /purpose: FIXED_FILM_PURPOSE/);
  assert.doesNotMatch(
    storyWizard,
    /filmPurposes|selectFilmPurpose|CHOOSE YOUR FILM|虹の橋|メモリアル/,
  );
  assert.doesNotMatch(storyWizard, /<span>ナレーション<\/span>/);
  assert.match(storyWizard, /const missingFields = useMemo<MissingField\[\]>/);
  assert.match(
    storyWizard,
    /const \[photoFiles, setPhotoFiles\] = useState<PhotoDraft\[\]>/,
  );
  assert.match(storyWizard, /const MIN_MEMORY_COUNT = 5/);
  assert.match(storyWizard, /const MAX_MEMORY_COUNT = 5/);
  assert.match(storyWizard, /MAX_PHOTOS_PER_MEMORY = 3/);
  assert.match(storyWizard, /memory\.photoKeys\.length >= 1/);
  assert.match(storyWizard, /物語にしたい日と、その日の一枚/);
  assert.match(storyWizard, /createMemoryDraft\("memory-5"\)/);
  assert.match(storyWizard, /基準写真にする/);
  assert.doesNotMatch(storyWizard, /この物語を削除|物語をもう1つ追加する/);
  assert.doesNotMatch(
    storyWizard,
    /photoRestoreNotice|wan-memory-had-selected-photos|写真をもう一度選んでください/,
  );
  assert.doesNotMatch(storyWizard, /photoGuideDialogRef|referenceSlots\.map/);
  assert.match(storyWizard, /未入力\$\{missingFields\.length\}項目を確認する/);
  assert.match(storyWizard, /onClick=\{\(\) => goToStep\(item\.step\)\}/);
  assert.match(storyWizard, /if \(step === 1\) \{/);
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
  assert.match(studio, /物語案をお預かりしました/);
  assert.match(studio, /絵本ページの制作へ進む前なら、何度でも変更できます/);
  assert.doesNotMatch(
    studio,
    /onClick=\{\(\) => selectConcept\(concept\.slot\)\}/,
  );
  assert.match(css, /\.concept-receipt-backdrop/);
  assert.match(migration, /status in \('concepts_ready', 'concept_selected'\)/);
  assert.match(migration, /purpose in \('いまを残す', '虹の橋メモリアル'\)/);
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
  assert.match(css, /\.photo-guide-photo-types/);
  assert.doesNotMatch(css, /border-left:\s*[34]px/);
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
  assert.match(
    css,
    /\.form-grid input, \.form-grid select, \.stacked-fields textarea \{ font-size: 16px; \}/,
  );
  assert.match(css, /\.album-manager-actions button \{ min-height: 44px;/);
  assert.match(css, /\.admin-mobile-sections/);
  assert.match(studio, /NEXT ACTION · 今やること/);
  assert.match(studio, /hasPendingConceptChange/);
  assert.match(studio, /id="materials"/);
  assert.match(studio, /id="delivery"/);
  assert.match(studio, /id="review-video"/);
  assert.match(admin, /まだ納品されていません/);
  assert.match(admin, /お客様名・ファイル名・用途を確認しました/);
  assert.match(admin, /disabled=\{\s*saving \|\|\s*!videoChecked/);
  assert.match(admin, /onChange=\{selectVideo\}/);
  assert.match(admin, /id="admin-photos"/);
  assert.match(admin, /物語別の制作用データをダウンロード/);
  assert.match(admin, /storage\s*\.from\("order-assets"\)\s*\.download/);
  assert.match(admin, /import\("fflate"\)/);
  assert.match(admin, /photo-manifest\.json/);
  assert.match(admin, /GPT_INSTRUCTIONS\.txt/);
  assert.doesNotMatch(admin, /createLandscape16x9/);
  assert.doesNotMatch(admin, /runway_16x9/);
  assert.doesNotMatch(admin, /runway_16x9_archive_path/);
  assert.match(admin, /original customer photos/);
  assert.match(admin, /Original customer photos stay in their original aspect ratio/);
  assert.match(admin, /requested_gpt_output/);
  assert.match(admin, /source_photos/);
  assert.match(admin, /wan-memory-storybook-production-export-3\.0/);
  assert.match(admin, /STORYBOOK_STYLE_PROFILE/);
  assert.match(admin, /MEMORY_STORYBOOK_PRODUCTION_PROTOCOL/);
  assert.match(admin, /MEMORY_STORYBOOK_PRODUCTION_PROMPT/);
  assert.match(admin, /MEMORY_STORYBOOK_PRODUCTION_v2\.txt/);
  assert.match(admin, /MEMORY STORYBOOK PRODUCTION v2\.0/);
  assert.match(admin, /production_protocol/);
  assert.match(admin, /original-aspect-ratio identity-locked references/);
  assert.match(admin, /transition_rules/);
  assert.match(admin, /gen4_turbo/);
  assert.match(admin, /physical_page_turn_without_crossfade/);
  assert.match(admin, /transition_page_image_plan/);
  assert.match(admin, /アカウントの連絡先を除いた分析・制作用JSON/);
  assert.match(admin, /admin_resolve_revision/);
  assert.match(admin, /admin_resolve_message/);
  assert.match(admin, /admin_register_video_asset/);
  assert.doesNotMatch(admin, /onChange=\{uploadFinalVideo\}/);
});

test("enforces operational workflow rules in the database boundary", async () => {
  const { readFile } = await import("node:fs/promises");
  const [migration, lockdown, story, studio, admin] = await Promise.all([
    readFile(
      new URL(
        "supabase/migrations/202607210001_operations_hardening.sql",
        root,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "supabase/post_deploy/operations_lockdown_after_admin_deploy.sql",
        root,
      ),
      "utf8",
    ),
    readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
  ]);
  assert.match(migration, /at least 5 source images are required/);
  assert.match(migration, /revision_used >= v_order\.revision_limit/);
  assert.match(
    migration,
    /status not in \('awaiting_materials', 'cancelled'\)/,
  );
  assert.match(
    migration,
    /create or replace function public\.admin_update_order/,
  );
  assert.match(
    migration,
    /create or replace function public\.admin_register_video_asset/,
  );
  assert.match(migration, /'review_video'/);
  assert.match(migration, /insert into public\.order_events/);
  assert.match(lockdown, /drop policy if exists orders_admin_update/);
  assert.match(story, /memory\.photoKeys\.length >= 1/);
  assert.match(story, /beforeunload/);
  assert.match(story, /photo-selection-feedback/);
  assert.match(studio, /revisionsRemaining/);
  assert.match(admin, /rpc\("admin_update_order"/);
  assert.doesNotMatch(admin, /from\("orders"\)\.update/);
});

test("blocks launch-critical skips and records consent and customer approval", async () => {
  const { readFile } = await import("node:fs/promises");
  const [release, marker, story, studio, admin, cron, readme] =
    await Promise.all([
      readFile(
        new URL("supabase/migrations/202607210003_release_readiness.sql", root),
        "utf8",
      ),
      readFile(
        new URL(
          "supabase/migrations/202607210002_operations_lockdown.sql",
          root,
        ),
        "utf8",
      ),
      readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
      readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
      readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
      readFile(new URL("app/api/cron/cleanup-drafts/route.ts", root), "utf8"),
      readFile(new URL("README.md", root), "utf8"),
    ]);
  assert.match(release, /customer_approved_at/);
  assert.match(
    release,
    /create or replace function public\.customer_approve_review/,
  );
  assert.match(release, /open revision must be resolved before delivery/);
  assert.match(release, /payment must be confirmed before production/);
  assert.match(
    release,
    /current consent record required before video production/,
  );
  assert.match(release, /age required/);
  assert.match(release, /personality required/);
  assert.match(release, /favorite memory required/);
  assert.match(release, /message to pet required/);
  assert.match(
    release,
    /create or replace function public\.bootstrap_first_admin/,
  );
  assert.doesNotMatch(release, /\('customer_review', 'quality_check'\)/);
  assert.doesNotMatch(marker, /drop policy if exists orders_admin_update/);
  assert.match(
    marker,
    /post_deploy\/operations_lockdown_after_admin_deploy\.sql/,
  );
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
  assert.match(
    readme,
    /supabase\/post_deploy\/operations_lockdown_after_admin_deploy\.sql/,
  );
});

test("requires a fresh scene-stills publication before video production", async () => {
  const { readFile } = await import("node:fs/promises");
  const [migration, studio, admin] = await Promise.all([
    readFile(
      new URL(
        "supabase/migrations/202607270001_stills_review_hardening.sql",
        root,
      ),
      "utf8",
    ),
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
  ]);
  assert.match(migration, /\('concept_selected', 'stills_review'\)/);
  assert.doesNotMatch(migration, /\('concept_selected', 'production'\)/);
  assert.match(
    migration,
    /open stills change request must be republished first/,
  );
  assert.match(migration, /stills_approved_asset_ids/);
  assert.match(migration, /admin_begin_stills_revision/);
  assert.match(studio, /hasOpenStillsChange/);
  assert.match(studio, /公開後にもう一度ご確認ください/);
  assert.match(admin, /調整を開始する/);
  assert.doesNotMatch(admin, /concept_selected: \["production"\]/);
});

test("keeps displayed policy dates and stored consent versions aligned", async () => {
  const { readFile } = await import("node:fs/promises");
  const [consent, terms, privacy, migration, storybookMigration] =
    await Promise.all([
      readFile(new URL("app/lib/consent.ts", root), "utf8"),
      readFile(new URL("app/terms/page.tsx", root), "utf8"),
      readFile(new URL("app/privacy/page.tsx", root), "utf8"),
      readFile(
        new URL(
          "supabase/migrations/202607270002_consent_version_alignment.sql",
          root,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "supabase/migrations/202608020001_moving_storybook_captions.sql",
          root,
        ),
        "utf8",
      ),
    ]);
  assert.match(consent, /terms: "2026-08-02-storybook-v1"/);
  assert.match(consent, /privacy: "2026-07-27"/);
  assert.match(consent, /aiNotice: "2026-08-02-storybook-v1"/);
  assert.match(
    terms,
    /動く絵本・決済・キャンセル案内更新：2026年8月2日（同意版\s*2026-08-02-storybook-v1）/,
  );
  assert.match(
    privacy,
    /決済情報の取り扱いに関する案内更新：2026年7月29日（同意版 2026-07-27/,
  );
  assert.match(migration, /o\.terms_version = '2026-07-27'/);
  assert.match(migration, /current policy versions required/);
  assert.match(storybookMigration, /2026-08-02-storybook-v1/);
  assert.match(storybookMigration, /order_has_current_consents/);
  assert.match(storybookMigration, /create_memory_order/);
  assert.match(storybookMigration, /save_memory_order_draft/);
  assert.match(storybookMigration, /accept_order_consents/);
});

test("records first-ten production metrics through an admin-only RPC", async () => {
  const { readFile } = await import("node:fs/promises");
  const [migration, admin, types] = await Promise.all([
    readFile(
      new URL("supabase/migrations/202607270003_production_metrics.sql", root),
      "utf8",
    ),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
    readFile(new URL("app/lib/supabase/types.ts", root), "utf8"),
  ]);
  assert.match(migration, /admin_save_production_metrics/);
  assert.match(migration, /production metrics must be nonnegative/);
  assert.match(migration, /production_metrics_saved/);
  assert.match(admin, /FIRST 10 METRICS/);
  assert.match(admin, /Runway使用クレジット/);
  assert.match(admin, /rpc\(\s*"admin_save_production_metrics"/);
  assert.match(types, /runway_credits_used: number/);
});

test("records and enforces consolidated photo-rights and external-service consent", async () => {
  const { readFile } = await import("node:fs/promises");
  const [peopleConsent, story, studio, admin, privacy] = await Promise.all([
    readFile(
      new URL(
        "supabase/migrations/202607210004_people_photo_consent.sql",
        root,
      ),
      "utf8",
    ),
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
  assert.match(
    peopleConsent,
    /current photo, people, minor and external service consent records are required before video processing/,
  );
  assert.match(story, /人物のお顔は映像に使用・生成せず/);
  assert.match(story, /外部AIサービス/);
  assert.doesNotMatch(story, /Runway|ChatGPT|OpenAI|GPT/);
  assert.match(story, /photo_rights_consent_accepted/);
  assert.match(studio, /p_people_policy_version/);
  assert.match(admin, /人物写真の取り扱い/);
  assert.match(privacy, /人物が写っている写真の取り扱い/);
  assert.match(privacy, /外部サービスでのデータの取り扱い/);
  assert.doesNotMatch(story, /広告利用や当社のAI学習には使用しません/);
});

test("stores exactly five stories with required scene photos", async () => {
  const { readFile } = await import("node:fs/promises");
  const [migration, upgrade, rules, story, uploads, admin, studio, css] =
    await Promise.all([
      readFile(
        new URL("supabase/migrations/202607210005_memory_entries.sql", root),
        "utf8",
      ),
      readFile(
        new URL(
          "supabase/migrations/202608020002_story_scene_sources.sql",
          root,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "supabase/migrations/202608020003_five_story_source_lock.sql",
          root,
        ),
        "utf8",
      ),
      readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
      readFile(new URL("app/lib/supabase/uploads.ts", root), "utf8"),
      readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
      readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
      readFile(new URL("app/globals.css", root), "utf8"),
    ]);
  assert.match(migration, /create table if not exists public\.order_memories/);
  assert.match(migration, /add column if not exists memory_id uuid/);
  assert.match(upgrade, /memory_photo_sort_order smallint/);
  assert.match(upgrade, /not between 1 and 3/);
  assert.match(rules, /v_memory_count <> 5/);
  assert.match(rules, /cardinality\(coalesce\(p_client_keys/);
  assert.match(story, /const MIN_MEMORY_COUNT = 5/);
  assert.match(story, /const MAX_MEMORY_COUNT = 5/);
  assert.match(story, /5つの思い出を教えてください/);
  assert.match(story, /その子らしい反応を書く/);
  assert.match(story, /この物語の場面写真/);
  assert.match(story, /save_order_memory_entry/);
  assert.match(story, /MAX_PHOTOS_PER_MEMORY = 3/);
  assert.match(story, /memory\.photoKeys\.length\s*<\s*MAX_PHOTOS_PER_MEMORY/);
  assert.match(story, /createMemoryDraft\("memory-5"\)/);
  assert.match(story, /while \(memories\.length < MIN_MEMORY_COUNT\)/);
  assert.match(story, /className="memory-entry-toggle"/);
  assert.match(story, /aria-expanded=\{expanded\}/);
  assert.match(story, /入力完了 ✓/);
  assert.match(
    story,
    /setActiveMemoryKey\([\s\S]*?current === memory\.clientKey[\s\S]*?memory\.clientKey/,
  );
  assert.match(story, /if \(currentStepMissingFields\.length > 0\)/);
  assert.match(story, /このステップの必須項目をすべて入力してください/);
  assert.match(story, /assign_memory_photos/);
  assert.match(story, /prune_order_memories/);
  assert.match(story, /save_order_production_fields/);
  assert.match(uploads, /const fileKey = `\$\{file\.name\}:\$\{file\.size\}`/);
  assert.match(admin, /制作用JSONをコピー/);
  assert.match(admin, /物語別 Runway 制作セット/);
  assert.match(admin, /primary_scene_source/);
  assert.match(studio, /studio-memory-list/);
  assert.match(studio, /studio-story-photo-add/);
  assert.match(studio, /makeStoryPhotoPrimary/);
  assert.match(studio, /order\.photo_analysis_status !== "approved"/);
  assert.match(admin, /storyScenes/);
  assert.match(admin, /5つすべての物語の場面/);
  assert.match(rules, /admin_set_memory_primary_photo/);
  assert.match(rules, /enforce_source_photo_edit_window_trigger/);
  assert.match(rules, /each story must appear exactly once in every concept/);
  assert.match(css, /\.memory-entry-card/);
  assert.match(css, /\.memory-entry-toggle/);
  assert.match(css, /\.step-required-panel/);
});

test("uses story-specific photo sources and requires operator approval", async () => {
  const { readFile } = await import("node:fs/promises");
  const [migration, sourceLock, story, admin, types, css] = await Promise.all([
    readFile(
      new URL(
        "supabase/migrations/202608020002_story_scene_sources.sql",
        root,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "supabase/migrations/202608020003_five_story_source_lock.sql",
        root,
      ),
      "utf8",
    ),
    readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
    readFile(new URL("app/lib/supabase/types.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(types, /memory_photo_sort_order: number \| null/);
  assert.match(
    types,
    /photoAnalysisStatus: order\.photo_analysis_status \?\? "needs_customer_input"/,
  );
  assert.match(migration, /memory_photo_sort_order smallint/);
  assert.match(
    migration,
    /create or replace function public\.save_order_production_fields/,
  );
  assert.match(
    migration,
    /create or replace function public\.assign_memory_photos/,
  );
  assert.match(migration, /category = 'source_image'/);
  assert.match(migration, /photo_analysis_status = 'pending_operator_review'/);
  assert.match(migration, /create or replace function public\.prune_order_memories/);
  assert.match(migration, /global_appearance_references', false/);
  assert.match(sourceLock, /確認済みの写真は変更できません/);
  assert.match(sourceLock, /five stories are required before source approval/);

  assert.match(story, /各物語には、その日の写真を1枚/);
  assert.match(story, /FIXED_FILM_STYLE/);
  assert.doesNotMatch(story, /referencePhotosComplete/);
  assert.match(story, /仕上がりの表現について確認しました/);
  assert.match(story, /save_order_production_fields/);
  assert.match(story, /assign_memory_photos/);
  assert.doesNotMatch(story, /Runway|ChatGPT|OpenAI|GPT|prompt|credit/i);

  assert.match(admin, /admin_set_photo_analysis_status/);
  assert.match(admin, /order\.status === "materials_submitted"/);
  assert.match(admin, /p_status: "reviewing_materials"/);
  assert.match(admin, /物語と写真を承認する/);
  assert.match(admin, /物語ごとの制作素材チェック/);
  assert.match(css, /\.memory-photo-role/);
});

test("stores storybook page sentences and burns them into the final video", async () => {
  const { readFile } = await import("node:fs/promises");
  const [migration, types, admin, studio, renderRoute, assembler, css] =
    await Promise.all([
      readFile(
        new URL(
          "supabase/migrations/202608020001_moving_storybook_captions.sql",
          root,
        ),
        "utf8",
      ),
      readFile(new URL("app/lib/supabase/types.ts", root), "utf8"),
      readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
      readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
      readFile(new URL("app/api/admin/render/route.ts", root), "utf8"),
      readFile(new URL("scripts/assemble_film.py", root), "utf8"),
      readFile(new URL("app/globals.css", root), "utf8"),
    ]);

  assert.match(migration, /add column if not exists story_caption text/);
  assert.match(migration, /admin_update_scene_caption/);
  assert.match(migration, /every scene still requires a story caption/);
  assert.match(types, /story_caption: string \| null/);
  assert.match(admin, /p_story_caption: caption/);
  assert.match(admin, /allSceneCaptionsReady/);
  assert.match(studio, /stills-story-caption/);
  assert.match(studio, /asset\.story_caption/);
  assert.match(renderRoute, /captions\.json/);
  assert.match(renderRoute, /--captions-json/);
  assert.match(assembler, /make_story_caption_overlay/);
  assert.match(assembler, /burn_story_captions/);
  assert.match(assembler, /物語の文章を重ねています/);
  assert.match(assembler, /PAGE_TURN_TRANSITION = "coverright"/);
  assert.match(assembler, /transition=\{PAGE_TURN_TRANSITION\}/);
  assert.doesNotMatch(assembler, /PHOTO_HOLD_SECONDS/);
  assert.doesNotMatch(assembler, /transition=fade:duration/);
  assert.match(renderRoute, /ordered\.length \* 5\.0 \+ 7\.0 - 0\.7/);
  assert.match(css, /\.stills-story-caption/);
});

test("autosaves all story steps and photos, then resumes the same account", async () => {
  const { readFile } = await import("node:fs/promises");
  const [migration, uploads, story, cleanup] = await Promise.all([
    readFile(
      new URL("supabase/migrations/202607240001_story_autosave.sql", root),
      "utf8",
    ),
    readFile(new URL("app/lib/supabase/uploads.ts", root), "utf8"),
    readFile(new URL("app/story/StoryWizard.tsx", root), "utf8"),
    readFile(new URL("app/api/cron/cleanup-drafts/route.ts", root), "utf8"),
  ]);
  assert.match(migration, /create table if not exists public\.story_drafts/);
  assert.match(
    migration,
    /create table if not exists public\.story_draft_assets/,
  );
  assert.match(migration, /current_step smallint/);
  assert.match(
    migration,
    /create or replace function public\.save_story_draft/,
  );
  assert.match(
    migration,
    /create or replace function public\.promote_story_draft_assets/,
  );
  assert.match(uploads, /uploadStoryDraftImage/);
  assert.match(uploads, /story_draft_assets/);
  assert.match(story, /wan-memory-story-draft-/);
  assert.match(story, /p_current_step: step/);
  assert.match(story, /前回の続きから再開しました/);
  assert.match(story, /写真と入力内容を保存しました/);
  assert.match(story, /photo\.status === "error"/);
  assert.match(story, /再試行/);
  assert.match(cleanup, /expiredStoryDrafts/);
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
  assert.equal(
    packageJson.scripts["build:sites"],
    "WRANGLER_LOG_PATH=.wrangler/wrangler.log vinext build",
  );
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

test("emails customers only when an administrator sends a studio message", async () => {
  const { readFile } = await import("node:fs/promises");
  const [admin, studio, route, notification, envExample] = await Promise.all([
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/messages/route.ts", root), "utf8"),
    readFile(new URL("app/lib/email/messageNotification.ts", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
  ]);

  assert.ok(admin.includes('fetch("/api/admin/messages"'));
  assert.match(route, /admin_send_message/);
  assert.match(route, /sendCustomerMessageNotification/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /userClient\.from\("orders"\)/);
  assert.ok(route.includes("/studio?order="));
  assert.ok(route.includes("#messages"));
  assert.match(admin, /admin-chat-panel/);
  assert.match(admin, /prepareCustomerInputMessage/);
  assert.match(admin, /value=\{messageDraft\}/);
  assert.match(notification, /内容はメールには記載していません/);
  assert.match(studio, /担当者からの確認やお願いはこちらに届きます/);
  assert.match(studio, /ご登録のメールアドレスにもお知らせします/);
  assert.match(studio, /<textarea\s+required\s+value=\{messageBody\}/);
  assert.match(studio, /disabled=\{sendingMessage\}/);
  assert.doesNotMatch(studio, /disabled=\{!messageBody\.trim\(\)\}/);
  assert.doesNotMatch(notification, /p_body|messageBody/);
  assert.doesNotMatch(
    studio,
    /sendCustomerMessageNotification|\/api\/admin\/messages/,
  );
  assert.match(envExample, /RESEND_API_KEY=/);
  assert.match(envExample, /RESEND_FROM_EMAIL=/);
});

test("uses Stripe-hosted Checkout and only verified webhooks confirm payment", async () => {
  const { readFile } = await import("node:fs/promises");
  const [
    checkout,
    paymentRequest,
    webhook,
    migration,
    studio,
    admin,
    envExample,
    packageSource,
  ] = await Promise.all([
    readFile(new URL("app/api/payments/checkout/route.ts", root), "utf8"),
    readFile(
      new URL("app/api/admin/payment-request/route.ts", root),
      "utf8",
    ),
    readFile(new URL("app/api/webhooks/stripe/route.ts", root), "utf8"),
    readFile(
      new URL("supabase/migrations/202607300001_stripe_checkout.sql", root),
      "utf8",
    ),
    readFile(new URL("app/studio/StudioClient.tsx", root), "utf8"),
    readFile(new URL("app/admin/AdminStudio.tsx", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(checkout, /\.from\("orders"\)/);
  assert.match(checkout, /if \(!APPLICATIONS_OPEN\)/);
  assert.match(checkout, /applications_paused/);
  assert.match(paymentRequest, /if \(!APPLICATIONS_OPEN\)/);
  assert.match(paymentRequest, /applications_paused/);
  assert.match(checkout, /await userClient[\s\S]*?\.from\("orders"\)/);
  assert.match(checkout, /order_lookup_failed/);
  assert.match(checkout, /checkout_storage_unavailable/);
  assert.match(checkout, /unit_amount: order\.quoted_price/);
  assert.match(checkout, /payment_method_types: \["card"\]/);
  assert.match(checkout, /idempotencyKey: `wm-checkout-/);
  assert.match(checkout, /order\.payment_status !== "invoice_sent"/);
  assert.match(checkout, /existing\.status === "complete"/);
  assert.match(checkout, /processing: true/);
  assert.doesNotMatch(checkout, /payload\.(amount|price)/);
  assert.match(webhook, /constructEvent\(rawBody, signature, webhookSecret\)/);
  assert.match(webhook, /STRIPE_TEST_WEBHOOK_SECRET/);
  assert.match(webhook, /process_stripe_checkout_completed/);
  assert.match(webhook, /charge\.refunded/);
  assert.match(
    migration,
    /create table if not exists public\.stripe_checkout_sessions/,
  );
  assert.match(
    migration,
    /create unique index if not exists stripe_checkout_one_active_order_idx/,
  );
  assert.match(
    migration,
    /payment completion and refunds are managed by Stripe/,
  );
  assert.match(
    migration,
    /grant execute on function public\.process_stripe_checkout_completed/,
  );
  assert.match(studio, /カードで支払う/);
  assert.match(studio, /お支払いはStripeの決済画面で行われます/);
  assert.match(studio, /この注文を現在のアカウントで確認できませんでした/);
  assert.match(studio, /決済情報を準備できませんでした/);
  assert.doesNotMatch(studio, /Stripeで安全に支払う/);
  assert.match(admin, /お支払いをご案内/);
  assert.doesNotMatch(admin, /Stripe決済をご案内/);
  assert.match(admin, /\/api\/admin\/payment-request/);
  assert.match(envExample, /STRIPE_SECRET_KEY=/);
  assert.match(envExample, /STRIPE_WEBHOOK_SECRET=/);
  assert.ok(JSON.parse(packageSource).dependencies.stripe);
});
