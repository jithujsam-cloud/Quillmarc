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

## Free trial, accounts and sandbox testing (October 22)
- **No waitlist: open sign-up with a 14-day free trial (owner's request).** `plan` and `trial_ends_at` live on `profiles`; founders can read them but not change them (column grants), and a test proves it.
- **When a trial ends, sending stops but nothing is deleted.** Creating updates, test sends and sends are refused on the server; viewing, settings and delete still work. A running send is allowed to finish.
- **No payment integration.** Stripe cannot be used for Quillmarc's own billing from India yet, so "Continue" goes to a configurable `BILLING_URL` (any payment link) or emails the owner, and the owner switches the account on.
- **Owner's Accounts page at `/admin`, gated by `ADMIN_EMAILS`.** Activate, add 14 days (from today or from the current end, whichever is later), or end access. Anyone else gets a 404.
- **"Explore with sample data" in setup.** Lets a trial user see the whole product in one click; the existing sample source is labelled on every screen and email.
- **The sandbox is enough to build and test everything.** Founders' connections never use the owner's Stripe account; only Stripe Connect needs an activated platform account, so it stays off until then.
- **`npm run stripe:sandbox` fills a test-mode account with fixtures; `--month` adds a month of joins, cancellations and an upgrade.** Stripe cannot backdate cancellations, so churn history accumulates for real. Live keys are refused; every fixture is tagged and `--reset` removes them.
- **With a sandbox key, Quillmarc also reads subscriptions on Stripe test clocks.** Stripe hides them from the normal list. Live keys never look for clocks (live accounts have none). If the key cannot read test clocks, the numbers screen says so instead of quietly showing less.
- **Sandbox history uses test clocks; Stripe still dates payments with the real date.** Past-dated payments are impossible in a sandbox. Quillmarc uses subscription dates, which test clocks set correctly.

## Dashboard, periods and revenue history (October 23)
- **`/dashboard` is analytics and `/updates` is the list of updates (owner's request).** The sidebar has both. Every page that used to say "Updates" and pointed at `/dashboard` now points at `/updates`.
- **An update covers a month, quarter, year or custom range.** Stored as `period_type`, `period_start`, `period_end` (inclusive) on `updates`; `month` stays as the first day of the first month so old code and links work. Existing monthly rows were backfilled, and a trigger keeps the two in step for inserts that only know the month.
- **Uniqueness is on type and exact dates, so July and Q3 can both exist.** Overlaps are allowed with a plain warning, because a founder may send a monthly and a quarterly update. Custom ranges are capped at 24 months, with no future end date, in the form, the server action and the database.
- **Calendar quarters and years only.** No fiscal years yet.
- **Every update page says what it covers.** A chip with the kind and the dates sits under the title on the editor and status pages, and the email, hosted page and subject carry the period name and dates. A running period says "so far".
- **Comparison with the previous period is saved with the update.** Investors see "vs Q2 2026: $13,533 (+$1,392)" in the email and letter.
- **Revenue is cash from Stripe charges, net of refunds.** The charges permission was already required. Refunds are dated to the charge, not the refund, because the charge list does not say when each refund happened.
- **Past revenue is saved, the present is read live.** `revenue_daily` holds one small row per day and currency. A sync re-reads from the start of the last-synced day (so today is current within five minutes) and the last 35 days once a day (refunds); older history is imported a month at a time, jumping over empty stretches, while the dashboard is open. A lock row stops two tabs importing at once. Saved rows are never rewritten after the 35-day window.
- **Monthly numbers for the dashboard are frozen per closed month in `metrics_snapshots`.** Only the running month is recalculated, so one dashboard load needs at most one read of the subscriptions, and usually none.
- **"Investors reached" is sent over everyone on the list when it went out.** `investor_total` is written when sending starts, so "18 of 24" stays true after the list changes. The dashboard and updates table show sent over total only; who opened it stays on each update's page. The Investors page shows received, read and last read per investor.
- **Revenue is best effort.** If Stripe cannot be reached the saved figures still show and the update is created without a revenue figure.
- **The canvas is no longer capped at 1152px.** It now grows to 1600px so wide screens do not leave an empty strip on the right. Panels use the landing page's 10px radius.
## Database hardening (October 22)
- **Applied the Supabase advisors' fixes in `20261022140000_hardening.sql`.** Outside callers can no longer run the template's `rls_auto_enable()` event trigger. Row rules call `auth.uid()` once per query, not once per row. The foreign keys that deletes cascade through are now indexed. Who can see what is unchanged; the RLS tests prove it.
- **Kept as is:** `rate_limits` and `waitlist` have no policies on purpose (server only). The leaked-password check does not apply, because sign-in is by magic link only.

## Investors first: gone quiet, timeline, asks (October 23)
- **"Gone quiet" means: has not read the update page in either of the last two updates they received.** Email opens are not used, because mail apps open messages by themselves. An update only counts as missed after 3 days. Investors who opted out, bounced or marked spam are never flagged, since they are not emailed. The rule is a pure function with tests (`investor-activity.ts`).
- **One investor page per investor (`/investors/[id]`).** Every update sent to them, with when it was delivered, opened and read, the same status words as the update page, their asks, and the one-line prompt when they have gone quiet.
- **The Investors list links to it and flags the quiet ones**, with a one-line prompt above the table: "Priya has not read your last 2 updates."
- **Asks are records, not text.** New `asks` table: the text, an optional investor who could help, an optional owner (blank means the founder), and a status: open, intro made, done. A founder can only name one of their own investors (checked in the database). Removing an investor keeps the ask.
- **Open asks go into the next update draft.** When a new update is created, its Asks bullets start with every ask that is not done. The founder edits them like any other bullet.
- **The dashboard opens with the investors row**: last update, how many investors it was sent to out of everyone on the list, who has gone quiet, and how many asks are open. It shows once something has been sent or an ask exists. Stripe numbers follow.
- **Left for later, by the owner's choice:** monthly auto-draft and reminder, own-domain sending, the 250-investor limit.
- **The demo seed has two earlier updates** with different read patterns, so the quiet flag has something to show.

## Loading speed (October 23)
- **The dashboard opens from what is saved and refreshes from Stripe in the background.** It used to wait for Stripe (subscriptions and payments) before showing anything. Now the page reads the saved monthly numbers and revenue straight away, and `DashboardRefresher` calls `/api/dashboard/refresh` after it opens, reloads the figures once, then keeps importing older payments. A founder's first visit shows a plain "Reading your Stripe data" line until the first figures arrive.
- **A dashboard-shaped loading screen** (`DashboardSkeleton`) shows while the page is fetched, instead of the generic list placeholder.

## Dashboard stats and loading screens (October 23)
- **The dashboard separates what matters from the detail.** Four headline cards (collected this month, MRR, customers, investors gone quiet), each with a badge for how it moved (green good, red bad, gold needs a look) and a line in words. Everything else is plain label-and-figure rows grouped under Revenue, Customers and Investors. Big cards against plain rows is a difference you can see at a glance.
- **Topic colour is a small dot only.** Money is sapphire, customers teal, investors gold. A first version put a thick coloured edge on top of each card; it curved at the rounded corners and looked wrong, so it was removed.
- **A loading screen for full reloads.** The page's HTML carries the wordmark and a ring; `BootDone` hides it once the page is ready. Moving between pages never brings it back. With no JavaScript it is hidden, and it hides itself after 8 seconds in any case so it can never block the page.
- **Every page's loading placeholder says "Loading your data"**, so it is clear something is happening.

## Dashboard list with tabs; Settings in four pages (October 23)
- **The third dashboard column is a short list with two tabs: Updates and Investors.** Up to six rows each, with a plain figure or a pill on the right ("6 of 6", "Draft", "Gone quiet"), every row a link, and "All updates" or "All investors" under it (plus a count of open asks). It replaced the investors stat rows, so the grid has no empty slot and the same information is one click away.
- **Settings are four short pages with tabs: Account, Stripe, Plan, Your data.** Account holds sender details, time zone and theme. Old links keep working: `/settings?stripe=...` (the way back from Stripe) and `?done=disconnected` forward to `/settings/stripe`, and the plan and Stripe links in the sidebar go straight to their tabs.

## Fixed-size dashboard panels; fewer lookups per page (October 23)
- **The three panels under the headline cards are one fixed height (400px on wide screens)**, so switching between the Updates and Investors tabs never changes any of them. The tab list holds up to 8 rows and scrolls inside its panel; the two stat panels share their rows out evenly. All three use the same heading, row height and figure style.
- **Pages ask who is signed in once, not three times.** The proxy, the sidebar and the page each asked Supabase, which is a network round trip every time. The sidebar and the page now share one lookup per request (`getAuth`, and `getSetupState` is read once per request too). The proxy still checks the session, as it must. If pages still feel slow, the usual cause is the app being hosted far from the Supabase database: set the Vercel function region to match the Supabase region.

## Email and password sign-in (October 23)
- **Sign-in is email and password, not a magic link (owner's request).** One page with "Sign in" and "Create account" (the free trial starts at account creation), a "Forgot your password?" page, a "Choose a new password" page reached from the reset email, and a Password section in Settings. Nothing about the account, trial, investors or updates changed.
- **Passwords: 8 to 72 characters, no other rules.** Length is what protects a password; rules about symbols push people to worse ones. The 72 limit is bytes, because the hash ignores anything after that. A Show button lets a person check what they typed.
- **A wrong email and a wrong password get the same answer**, and "forgot password" always says an email is on its way whether or not an account exists, so nobody can find out who has an account. The one exception: creating an account with an email that already exists says so, because a person needs to know to sign in instead.
- **Email confirmation is a Supabase setting, and the app handles both.** On: creating an account shows "Check your email", and the link signs them in. Off: they are in straight away. Confirmation and reset links go through `/auth/callback`, which only ever goes to the dashboard or the reset page, never to an address taken from the link.
- **Attempts are limited** per address and per connection for sign-in, account creation and reset requests.
- **A form that fails keeps the email** the person typed. The browser clears form fields after a submit; the email field is held in the page so an error never makes anyone retype it.
- **Existing accounts made with a magic link have no password.** They use "Forgot your password?" once to set one.
