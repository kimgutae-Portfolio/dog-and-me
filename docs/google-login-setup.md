# Google login setup

The client now offers `Googleで続ける` on `/auth` login and signup screens when Supabase's public settings report Google enabled. Email login remains available. There is no Google client secret in the website code or environment.

## Google Cloud / Google Auth Platform

1. Create or select the WAN MEMORY project. Configure an External OAuth audience, app name WAN MEMORY, support email, homepage `https://www.wanmemory.com`, privacy URL `/privacy`, and terms URL `/terms`. Use actual business contact information.
2. Create an OAuth client of type Web application.
3. Add authorized JavaScript origins `https://www.wanmemory.com` and `http://localhost:3000`.
4. Add the authorized redirect URI shown by Supabase's Google provider settings. For the current project it is `https://pltuexrpvrxurjsicjay.supabase.co/auth/v1/callback`. This is different from the app's post-login redirect.
5. Use only basic identity scopes (openid, email, profile); Gmail inbox permissions are not needed.
6. During Testing, add test users. Before opening signup to customers, make the Google app available to its intended audience and complete any verification Google requires.

## Supabase dashboard

1. Authentication → URL Configuration: Site URL `https://www.wanmemory.com`.
2. Add redirect allowlist entries `https://www.wanmemory.com/auth**` and `http://localhost:3000/auth**`. The wildcard retains `?next=...` within the auth path; do not allow arbitrary production hosts.
3. Authentication → Sign In / Providers → Google: enter Client ID and Client Secret from Google, then enable Google and save. Do not enable skip nonce/email verification options.
4. Refresh `/auth?mode=signup`. The Google button appears automatically after provider lookup, without a new environment flag.

## Existing app behavior

- Browser Supabase client detects the implicit OAuth session on `/auth`; no server cookie callback is used in this app.
- Signup defaults to `/story`; login defaults to `/studio`; explicit safe same-site `next` paths are preserved.
- Existing database profile trigger copies verified auth email and full_name to profiles. Pet name is collected in the story form, not required before OAuth.
- Existing order/chat notification code continues to use profiles.email.
- Existing email-user identity linking must be verified with a test account before launch; never manually merge orders based on an unverified email.
- Provider lookup failure leaves email authentication usable.

## End-to-end verification before production

Test with a new Google user and an existing email user using the same verified email. Check a single profile, correct email, retained existing orders, signup/login destinations, cancellation, and return from a story draft. Confirm normal admin MFA enforcement remains unchanged. Test notification delivery using a designated test order, not a real customer. Verify on mobile Safari/Chrome as well as desktop. Frontend checks alone cannot validate the external OAuth configuration.

References:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
