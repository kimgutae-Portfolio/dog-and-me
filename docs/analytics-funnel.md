# Paid customer funnel measurement

## Delivery and duplicate prevention

The published public GTM-WBMHCBXJ container (version 3, inspected read-only on
2026-10-16) already forwards the legacy start/story/auth event names to
G-31J209RFN1. Keep that forwarding once. `trackEvent` sends only the new event
names directly to the existing Google tag; it does not create another Google
tag configuration or pageview. Do **not** add duplicate GTM triggers for the new
directly-forwarded names. Localhost and preview hosts do not load production GTM.

| Event | Actual meaning |
| --- | --- |
| `story_start_complete` | Dog-name / intention step completed, not registration |
| `story_signup_prompt_view` | Registration choices shown |
| `google_signup_click` / `email_signup_start` | Attempt, not successful account creation |
| `signup_confirmation_sent` | Email signup API returned with no authenticated session; confirmation still required |
| `sign_up` | Confirmed authenticated account created during the pending Google/email attempt |
| `signup_complete` | Legacy alias for the same confirmed registration; keep old explorations working |
| `story_view`, `story_input_start`, `story_photo_added`, `story_submit` | Existing input funnel |
| `proposal_view` | Published proposal section actually entered viewport, once per order/browser session |
| `proposal_select` | Proposal selection successfully saved |
| `begin_checkout` | Customer opens prepared Stripe checkout, once per order/browser session |
| `checkout_error` | Preparing checkout failed; `error_code` is an allowlisted generic code |
| `checkout_cancel` | Customer returned through Stripe cancel URL; not a proven card failure |
| `purchase` | Authenticated read-only server check found an amount-matched live Stripe Checkout row already marked paid by the signed webhook |

`sign_up` and `signup_complete` describe the same action. Do not mark both as
independent advertising conversions or sum them. Existing email completion
events from before this release may include unconfirmed accounts and are not
directly comparable to the corrected event.

## Purchase proof and limitations

`/api/payments/analytics` requires the customer's access token and explicitly
scopes the order and checkout row to that customer. It cannot mark an order paid.
It excludes unpaid, complimentary, test-mode, mismatched and refunded checkouts.
Only payments made within the last 24 hours are eligible, so reopening old
delivered orders does not create new revenue. The transaction ID is a stable
SHA-256-derived opaque value, not an order number, customer ID or Stripe secret.
JPY amounts use yen directly: ¥12,800 is `value: 12800`, not `128`.

Browser localStorage deduplicates purchase observations and GA4 receives the
same `transaction_id` on repeat browser observations. Neither `payment=success`
nor a button click proves a purchase. Payment processing/webhook behavior is
unchanged and never depends on analytics being available.

This is browser-observed verified payment tracking, **not** guaranteed
server-to-server delivery. If the customer closes Stripe and never reopens
Studio, blocks analytics, uses a different browser, or returns after 24 hours,
GA4 may miss the purchase. Stripe / the paid-order database remain the financial
source of truth. Fully server-side delivery would need a separately configured
Measurement Protocol API secret and durable delivery/retry design. No secret
or production GA4 settings are created by this implementation.

Registration completion similarly relies on a local pending-attempt marker;
confirmation in a different browser may be missed. Returning Google logins are
not mislabeled as new registrations.

## Privacy and release verification

No custom event includes dog names, owner names, emails, story text, photo URLs,
access tokens, raw order/user IDs or Stripe session IDs. Canonical page URLs
remove queries/hashes on auth/story/start/studio. Public landing URLs preserve
only allowlisted safe-format campaign/click identifiers needed for attribution.
Customer-specific websites and operator routes remain excluded.
External HTTP(S) referrers retain only their origin (for example,
`https://www.google.com` or `https://l.instagram.com`), preserving referral
attribution without forwarding a search, profile path or query string.
Same-site customer/operator referrers are excluded.

These protections cover bootstrap configuration and explicitly sent events.
The existing GA4 enhanced-measurement history/pageview configuration is managed
outside this repository: React's post-navigation effect cannot guarantee that
an automatic history event never races it. Inspect actual automatic hits in
Tag Assistant before claiming all automatic pageviews are sanitized; disable or
reconfigure automatic history measurement externally if necessary.

Before relying on reports after an approved deployment:

1. Use Tag Assistant / GA4 DebugView to check one new event per action and no
   production analytics traffic from local/preview environments.
2. Verify `sign_up` only after confirmation, returning Google login does not
   increment it, and the existing start/story events still arrive.
3. Verify `proposal_view`, `proposal_select`, `begin_checkout`, cancellation and
   preparation errors. Cancel/test/complimentary payment must not emit purchase.
4. Verify the first genuinely live paid customer's webhook record and one GA4
   purchase with matching JPY value. Do not create a real charge solely for QA
   without the owner's approval.
5. Register custom event-scoped dimensions if breakdowns are needed:
   `proposal_slot`, `proposal_count`, `error_code`, plus existing input parameters.
   The current legacy GTM tag has no custom parameter mapping, so its legacy
   parameter forwarding needs explicit GTM configuration/verification before
   those parameter breakdowns can be trusted. Event-name counts already forward.
6. Review GA4 key events / Google Ads imports separately. No advertising goal
   or production tag configuration was changed in the repository task.

Official references:

- https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- https://developers.google.com/tag-platform/gtagjs/reference
- https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events
