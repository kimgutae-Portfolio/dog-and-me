# Conversion changes — local verification, 2026-10-16

## Scope

- Moka demo: complete film before page gallery, cover shortcut to film.
- Consultation CTAs describe registration and photo/story entry accurately.
- Home production flow: three visible steps, seven optional detailed steps.
- Confirmed signup, proposal, checkout and verified-purchase measurement.
- Permanent standard price of JPY 12,800 through a new DB migration.

## Passed locally

- Production build (`npm run build`), TypeScript, targeted ESLint, diff check.
- All 16 focused analytics, conversion UI, auth-navigation and address tests.
- Disposable PostgreSQL pricing test: fixed price after 25 legacy orders,
  creation/submission consistency, paid/free/history preservation, permissions,
  consent/photo gates, and atomic rollback for old higher-price Stripe sessions.
- Browser checks at 320×568, 390×844 and 1280×900: no horizontal overflow;
  consultation buttons fit; three-step disclosure opens/closes correctly.
- Native video playback works. Moka guide hides while the player is in view so
  it cannot cover the controls; no unexpected audio autoplay.
- Production GTM does not load on localhost.

## Existing broader-suite failures

The combined suite is 54 passed / 6 failed. All six remaining failures were also
present before these changes; the previous baseline had nine failures. They are
in `tests/rendered-html.test.mjs`: SEO guide copy, personal-site slug assertions,
sprite prompt version, approval RPC source assertion, caption status copy, and
chat close-handler source shape. They were not disabled or reclassified as passes.

## Not deployed or verified live

- No Git commit/push, production DB migration or GA4/GTM configuration change.
- Apply pricing only during an approved release, following
  `PERMANENT_PRICE_RELEASE.md`; a main push alone cannot update DB functions.
- Check real GA4 reception/Tag Assistant and conversion settings after release.
- Purchase tracking is browser-observed after signed-webhook payment proof: the
  customer must return/reopen Studio within 24 hours. It is not guaranteed
  server-to-server delivery. See `analytics-funnel.md` for attribution, signup
  confirmation, deduplication and privacy limitations.
