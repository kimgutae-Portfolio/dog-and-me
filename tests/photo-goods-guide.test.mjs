import assert from "node:assert/strict";
import test from "node:test";

// Run against an owned local Next server after build:vercel. Forward the public
// host so metadata is tested exactly as it will be on the production domain.
const testOrigin = process.env.WM_SEO_TEST_ORIGIN;
if (testOrigin && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(testOrigin).hostname)) {
  throw new Error("WM_SEO_TEST_ORIGIN must point to a local test server");
}
const options = { skip: !testOrigin && "Set WM_SEO_TEST_ORIGIN to an owned local Next server" };
const articlePath = "/aiken-photo-goods";
const articleUrl = `https://www.wanmemory.com${articlePath}`;

async function get(path) {
  const response = await fetch(new URL(path, testOrigin), {
    headers: { "x-forwarded-host": "www.wanmemory.com", "x-forwarded-proto": "https" },
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200, `${path} must return 200`);
  return response.text();
}

test("photo goods guide serves indexable, server-rendered Japanese editorial content", options, async () => {
  const html = await get(articlePath);
  assert.match(html, /<html lang="ja"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.wanmemory\.com\/aiken-photo-goods"/);
  assert.match(html, /<meta name="robots" content="index, follow"/);
  assert.doesNotMatch(html, /<meta name="robots" content="noindex/);
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.match(title ?? "", /愛犬の写真で作るオーダーメイドグッズ/);
  assert.match(html, /<meta property="og:type" content="article"/);
  assert.match(html, /<meta property="og:url" content="https:\/\/www\.wanmemory\.com\/aiken-photo-goods"/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);

  const body = html.match(/<article\b[\s\S]*?<\/article>\s*<footer/)?.[0] ?? html;
  for (const heading of ["フォトブック", "フォトフレーム・写真パネル", "キーホルダー・写真小物", "マグカップ・トートバッグ", "思い出動画・動く絵本"]) {
    assert.ok(body.includes(heading), `${heading} should be present without running JavaScript`);
  }
  assert.ok(body.includes("AIを活用した水彩タッチの絵と文章"));
  assert.ok(body.includes("紙の本や物品の配送は含まれません"));
  assert.match(body.replace(/<[^>]*>/g, ""), /¥12,800/);
  assert.doesNotMatch(body, /先着20|モニター価格|検索順位を保証/);
});

test("photo goods guide has valid visible FAQ, article markup and working table-of-contents targets", options, async () => {
  const html = await get(articlePath);
  const entries = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => JSON.parse(match[1]));
  const article = entries.find((entry) => entry["@type"] === "BlogPosting");
  assert.ok(article);
  assert.equal(article.mainEntityOfPage, articleUrl);
  assert.equal(article.author.name, "WAN MEMORY");
  assert.equal(article.inLanguage, "ja-JP");
  assert.ok(article.image.startsWith("https://www.wanmemory.com/film/moka/"));
  assert.ok(entries.some((entry) => entry["@type"] === "WebPage"));
  assert.ok(entries.some((entry) => entry["@type"] === "BreadcrumbList"));
  const faq = entries.find((entry) => entry["@type"] === "FAQPage");
  assert.equal(faq.mainEntity.length, 4);
  const articleBody = html.match(/<article\b[\s\S]*?<\/article>\s*<footer/)?.[0];
  assert.ok(articleBody, "the guide must render an article element");
  const visibleArticle = articleBody.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  const renderedFaqs = [...visibleArticle.matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/g)]
    .map((match) => match[0].replace(/<[^>]*>/g, ""));
  assert.equal(renderedFaqs.length, 4, "all FAQ entries must render as disclosures");
  for (const question of faq.mainEntity) {
    assert.ok(renderedFaqs.some((text) => text.includes(question.name) && text.includes(question.acceptedAnswer.text)),
      `${question.name} must have a matching rendered question and answer`);
  }
  for (const anchor of ["formats", "photo-check", "gift-check", "storybook", "faq"]) {
    assert.ok(html.includes(`href="#${anchor}"`));
    assert.ok(html.includes(`id="${anchor}"`));
  }
  assert.match(html, /href="\/film\/moka-demo"/);
  assert.match(html, /href="\/start"/);
});

test("photo goods guide is discoverable through the sitemap, guide directory and related content", options, async () => {
  const sitemap = await get("/sitemap.xml");
  const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]).pathname);
  assert.equal(sitemapPaths.filter((path) => path === articlePath).length, 1);
  assert.doesNotMatch(sitemap, /\/auth|\/story|\/studio|\/admin/);
  for (const path of ["/", "/guides", "/dog-birthday-message"]) {
    const html = await get(path);
    assert.ok(html.includes(`href="${articlePath}"`), `${path} should link to the new guide`);
  }
});
