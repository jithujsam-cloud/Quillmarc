# Decisions: Quillmarc app

Judgment calls made while building the MVP, October 21, 2026, each with a one-line reason.
The marketing site's decisions live in `../DECISIONS.md`.

## Project
- **The repo held a static marketing site, not a Next.js project, so the app is a new Next.js app in `web/`.** The marketing site stays untouched and deploys as before; the app deploys as a second Vercel project with Root Directory `web`.
- **The root `.vercelignore` uses leading slashes, and the marketing site redirects `/web/*` to `/`.** Vercel applies the root `.vercelignore` to every project in the repo, so ignoring `web` there emptied the app's build; the redirect keeps the app's source off the marketing site.
- **Next.js 16.4 (App Router), React 19.2, Tailwind 4, TypeScript 5.9, Vitest 5.** `npm audit` flagged Next 15's bundled PostCSS and Vitest 3; the current majors fix that. TypeScript 7 and ESLint 10 were skipped as too new for the Next tooling.
- **Remaining `npm audit` items are in ESLint's dev dependencies (braces).** They never ship to production and have no non-breaking fix.
- **Next 16 renamed middleware to `src/proxy.ts`.** It refreshes the session cookie and sends signed-out visitors to `/login`.
- **Stripe and Resend are called with `fetch`, not their SDKs.** Fewer dependencies, and tests can inject a fake `fetch`.
- **Added only `@supabase/ssr`, `@supabase/supabase-js` and `server-only` as runtime dependencies.** Dev-only: `pg`, `tsx`, Playwright and axe for tests and the seed.
- **Separate Supabase project from the waitlist.** The app's migrations live in `web/supabase/migrations`; mixing them with the waitlist table would couple two products.

## Brand and UI
- **Rebuilt every screen with the taste skill's app-screen rules (October 21, owner's request: "the overall UI does not look good").** Style dealt: accent ladder (seed 1271542462), with Quillmarc's own palette kept.
- **Accent ladder: Sapphire at full strength only on small marks** (the one filled button style, the read marks, the active nav icon); its pale tints carry areas. Gilt gold is the accent in dark, as on the landing page. The skill bans a second accent family.
- **Shell: ruled T-frame.** A 232px sidebar (wordmark, company, nav, Stripe status, account) and a 64px top bar (breadcrumb, this screen's actions, theme switch) on one ground, divided by 1px rules. On phones the sidebar folds into a full-screen menu.
- **Light, dark and match-system, switchable from the top bar, Settings and the investor page.** Saved per device in `localStorage` (same key as the marketing site) and set before first paint, so there is no flash.
- **The app uses the landing page's colours (October 21, owner's request: "the web app isn't following the same design colours as the landing page").** Ivory ground, champagne hairlines and Midnight Navy ink in light; the brand's deep navy with Gilt gold as the accent in dark, as in `brand/tokens.css`. This replaces the earlier cool-grey light theme and neutral-black dark theme.
- **The app uses the landing page's fonts (October 21, owner's request).** Newsreader at weight 400 for page and panel headings, Hanken Grotesk for all other text, and Geist Mono for KPI figures, as on the landing page. Newsreader also sets the letter investors read. Small in-panel subheads (h3) stay in Hanken at 600.
- **App titles are 24px nouns with a one-line finding underneath** ("August: 2 of 6 investors read it"), not display headlines.
- **Signature element: the read strip.** One mark per investor, Sapphire at three intensities (read, opened, delivered), so "who read it" is seen at a glance on the dashboard and the status page.
- **KPIs are one divided panel, label over value, no icons or tiles.** The lead figure (MRR, or Read on the status page) is larger than its siblings.
- **One filled button per screen.** In the editor the step's "Save and continue" is the primary; the top bar's "Send to N" is outlined.
- **The editor keeps the owner's mockup layout:** steps on the left, the live email on the right (desktop). The Preview tab shows only on phones.
- **Emails stay light in dark mode.** Many mail apps force or ignore dark styles.
- **Demo seed uses believable fictional people on the reserved `.example` domain.** The skill flags `example.com` as placeholder data, and `.example` can never receive email.
- **Loading and motion (owner's request: "there is no loading or any animation").** Each app screen has a loading screen in its final layout with flat grey placeholders (no shimmer). Every button that saves, sends or recalculates shows a spinner and locks. Nav and step links show a small ring until the next screen arrives. New screens rise in over 220ms, the read strip fills in mark by mark, the phone menu slides in, messages fade in, and theme changes ease over 200ms. The skill's app rules say screens should not perform an entrance; the owner asked for motion, so it is kept short and subtle. Everything turns off under "reduce motion".
- **Checks:** the skill's lint and its inspector (`--app`) pass with 0 fails and 0 warnings on all 14 screens at 1440, 768 and 390px; axe (WCAG 2.1 AA, including contrast) passes on every page in light and dark.

## Auth
- **Magic link with PKCE (`/auth/callback` exchanges the code), plus the `token_hash` flow.** Supabase's default, and the token-hash form works if the email template is customised later.
- **Login rate limit: 10 per IP and 5 per email per 15 minutes, stored in Postgres.** In-memory limits do not work across serverless instances.
- **Rate limits fail open if the database is down.** A database blip should not lock every founder out.

## Data model and security
- **Every table has `user_id` referencing `auth.users` with `on delete cascade`.** Simple RLS policies (`user_id = auth.uid()`) and "delete my data" is one call.
- **Delete my data calls `auth.admin.deleteUser`.** The cascade removes profile, Stripe key, investors, updates, sends, events and suppressions immediately; a test proves it.
- **The browser role gets column grants, not table grants.** Founders cannot read the encrypted key, write delivery records, clear an opt-out or set `test_sent_at` themselves; tests prove each.
- **Sent updates are frozen by RLS (`status = 'draft'` on update).** What investors received cannot change afterwards.
- **Added a `suppressions` table beside `investors.suppressed`.** A bounced address stays suppressed even if the investor is deleted and pasted in again.
- **Hosted-page tokens are 32 random bytes (43 base64url characters), stored as-is.** 256 bits is unguessable; the email needs the raw token, and RLS hides it from other users.
- **Stripe keys: AES-256-GCM, random 12-byte IV per key, stored as `v1:iv:tag:ciphertext`.** The version prefix allows key rotation later.
- **One update per founder per month.** Picking a month that already has a draft opens it.
- **Deleting an investor deletes their send history.** Simplest; the alternative is soft delete, which can come later.

## Stripe
- **Restricted keys only (`rk_live_` or `rk_test_`); `sk_` keys are refused outright.** A secret key always has full write access.
- **Read check: one GET each for customers, subscriptions, prices, invoices and charges.**
- **Write check: POST to update an object that does not exist (for example `cus_quillmarc_probe`) on seven resources. 403 means no write access; 404 means write access, so the key is refused.** It can never change anything. Not yet tried against a live Stripe key because none was available; verify with one key of each kind before onboarding founders.
- **Stripe API version pinned to 2024-06-20, with `expand[]=data.discounts`.** Response shape cannot drift under us; the normaliser also reads newer shapes.
- **Connect with Stripe (OAuth, `read_only` scope) is built, beside the pasted key.** The owner asked for the full Stripe connection; one click is easier for founders than making a restricted key.
- **Connect stores only the account id, never Stripe's tokens.** Requests use the platform key plus a `Stripe-Account` header, and Stripe holds them to read only.
- **A grant with any scope but `read_only` is refused.**
- **The OAuth state is a random token in a 10-minute httpOnly cookie, tied to the signed-in founder.** A stranger cannot link their Stripe account to someone else's Quillmarc account.
- **Disconnect, switching to a key, and delete all revoke Connect access on Stripe's side too.**
- **The button shows only when `STRIPE_CONNECT_CLIENT_ID` and `STRIPE_SECRET_KEY` are set.** Without them the app falls back to the pasted key, so nothing breaks before Connect is set up.
- **`STRIPE_API_BASE` and `STRIPE_CONNECT_BASE` exist for the local test stack's fake Stripe only.** The browser test runs the full Connect round trip without touching Stripe.
- **Every redirect uses `APP_URL`, not the request's host.** The host can differ from `APP_URL` (localhost versus 127.0.0.1, or a Vercel alias), and the sign-in cookie belongs to `APP_URL`.
- **The restricted-key check was run against a real Stripe sandbox key on October 21: five reads returned 200, seven write probes returned 403, and the key was accepted.** The key was used in memory only, never written to the repo.
- **Demo seed uses a `sample` connection method that returns fictional subscriptions.** Labelled "Sample data" on every screen, email and page that shows its figures.

## Metrics
- **All months in UTC.** One clear rule; founders in other zones see at most a few hours of difference at month edges.
- **`active` and `past_due` count; `unpaid` is excluded with `incomplete`, `incomplete_expired` and `paused`.** Unpaid means revenue has stopped.
- **Paused subscriptions are excluded from every month.** Stripe does not say when a pause began.
- **A "once" discount lasts one billing interval.** It applies to one invoice.
- **Main currency = most subscriptions counted this month or last.** Amounts in different currencies cannot be compared without exchange rates.
- **Only five figures are editable; net new MRR and growth are always derived.** Fewer controls, and the figures cannot contradict each other.
- **Month choices: this month (to date) and the 11 before it; default last month.** Founders usually report on the month just finished.

## Editor and sending
- **`/updates/new` picks the month, then the draft continues at `/updates/[id]/edit` in five steps.** The draft must exist to save edits between steps.
- **Bullets are one textarea per group, one bullet per line, up to 10 per group and 500 characters each.**
- **Test sends go to the founder's sign-in email and link to the founder-only preview.** A test should not create an investor token.
- **The test gate does not reset when the draft is edited.** The brief asks for "a test has been sent for this update"; resetting would add friction for typo fixes.
- **Send to investors needs a confirm step, and freezes the update.**
- **Queue: one `sends` row per investor per update (unique pair), claimed with `FOR UPDATE SKIP LOCKED`, sent with idempotency key `send-<row id>`.** A crash at any point is retried without a second email; a test simulates a crash after the provider accepted.
- **Rows stuck in "sending" for 2 minutes are reclaimed.** That is the crash window.
- **Three attempts, then "failed". 600 ms between emails.** Stays under Resend's default rate limit.
- **The queue runs right after Send (Next `after()`), and the status page keeps calling `/api/updates/[id]/process` while anything is queued.** Vercel has no long-running worker; this needs no extra service.
- **Investors are re-checked just before each email.** Someone who opts out mid-send is skipped.
- **"Send me a copy" is a separate email with key `copy-<update id>`, sent once after the queue drains.**
- **Mock email provider unless `EMAIL_PROVIDER=resend`.** Tests and local runs can never send real email.
- **Mock mode shows a "Simulate events" button on the status page, labelled as mock.** So the whole flow can be tried without Resend; it never appears when real email is on.

## Tracking
- **Reads are logged by a script on the hosted page after 1.5 seconds, not on the server render.** Link scanners fetch pages without running scripts, so they no longer count as reads.
- **One read per investor per 30 minutes.** A reload is not a second read.
- **The read endpoint answers 204 for any token.** It cannot be used to test whether a token exists.
- **Opt-out from the email link needs a button press; the List-Unsubscribe header supports one-click POST (RFC 8058).** Scanners cannot unsubscribe people, and Gmail and Yahoo get the one-click they require.
- **Transient bounces do not suppress.** A full mailbox is not a reason to stop forever.
- **Events for test sends and founder copies are ignored.** They have no sends row.
- **Added "failed" and "skipped" to the status list.** The table must be honest when an email never went out.
- **Status order: opted out, marked as spam, bounced, read, opened, delivered, sent, queued.**
- **"Last event" is the newest real event, or the queue time if nothing happened yet.**
- **Webhook rate limit: 600 per minute per IP.** Generous for Resend bursts, still a cap.
- **A webhook storage error returns 500.** Resend then retries; the svix-id makes the retry safe.

## Pages
- **Added `/investors` to manage the list after onboarding, and `/updates/[id]/preview` for the founder.** The brief requires an investor list and a hosted-page preview.
- **Wrote app-specific `/privacy` and `/terms`.** The marketing site's pages cover only the waitlist and say so.
- **App pages are `noindex`; hosted update pages also send `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`.** Private links should not leak into search or referrer logs. This is why Lighthouse SEO reads 60 on those pages.
- **Reply-to must pass a format check, must not be a no-reply address, and its domain must accept mail (MX, or A as fallback).** "Must be a real inbox" cannot be proved without sending, so this rejects the common mistakes.

## Testing
- **Integration tests run against a real Postgres plus PostgREST, started by the test setup, with a small Supabase stand-in for `auth`.** Docker was not available; this tests the real SQL, RLS and the real supabase-js calls.
- **PostgREST is downloaded once into `.cache/bin` (Linux x64).** Tests skip with a message where that is not possible.
- **The end-to-end test signs in by writing the session cookie, not by email.** The stand-in has no mail server; the magic link itself is Supabase's code.
