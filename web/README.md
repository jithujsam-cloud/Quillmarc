# Quillmarc app

The founder app: connect Stripe read-only, review the month's numbers, write a few bullets, send one
email per investor, and see who received, opened and read it. Next.js (App Router), Supabase, Resend.

The marketing and waitlist site is the repository root. This app lives in `web/` and deploys as its own
Vercel project. Other docs: `METRICS.md` (how numbers are calculated), `DECISIONS.md` (every judgment
call), `DELIVERABILITY_CHECKLIST.md` (manual email checks), `.env.example` (every setting).

## Set up and deploy (13 steps)

1. **Supabase project.** At supabase.com create a new project (not the waitlist one). Note the database password.
2. **Run the migration.** In the project's SQL Editor, paste and run `web/supabase/migrations/20261021100000_app_schema.sql`. (Or with the Supabase CLI: `supabase link` then `supabase db push` from `web/`.)
3. **Auth settings.** In Authentication, URL Configuration, set Site URL to your app address (for example `https://app.yourdomain.com`) and add `<APP_URL>/auth/callback` to Redirect URLs. Add `http://localhost:3000/auth/callback` too for local work. Email sign-in is on by default.
4. **Auth email sender.** In Authentication, SMTP Settings, use Resend's SMTP (host `smtp.resend.com`, user `resend`, password your Resend API key) so magic links come from your domain instead of Supabase's rate-limited test sender.
5. **Resend domain.** In Resend, Domains, add your sending domain (for example `updates.klaroh.com`), add the DNS records it shows at your DNS host, wait for Verified, and turn on open tracking for the domain.
6. **Resend API key.** In Resend, API Keys, create a key with sending access.
7. **Encryption key.** Run `openssl rand -hex 32` and keep the output.
8. **Vercel project.** Import this repository as a new project. Set Root Directory to `web`. Framework: Next.js.
9. **Environment variables.** In Vercel, add every variable in `web/.env.example`: Supabase URL, anon key and service role key (Project Settings, API), `ENCRYPTION_KEY`, `RESEND_API_KEY`, `SENDING_DOMAIN`, `APP_URL`, `CONTACT_EMAIL`, and `EMAIL_PROVIDER=resend`. Leave `RESEND_WEBHOOK_SECRET` for step 11.
10. **Deploy.** Deploy, then add your custom domain in Vercel and make sure it matches `APP_URL`.
11. **Resend webhook.** In Resend, Webhooks, add `<APP_URL>/api/webhooks/resend` with events sent, delivered, delivery delayed, opened, clicked, bounced and complained. Copy its signing secret into Vercel as `RESEND_WEBHOOK_SECRET` and redeploy.
12. **Demo data (optional).** Locally, with the same Supabase values in `web/.env.local`: `cd web && npm install && SEED_USER_EMAIL=you@yourdomain.com npm run seed`. Sign in with that address to see sample data.
13. **Check delivery.** Work through `DELIVERABILITY_CHECKLIST.md` before the first founder sends.

## Free trial and accounts

There is no waitlist. Anyone can sign up and gets 14 days with everything on. When the trial ends,
founders can still see everything, but creating updates and sending are paused until you switch them
on. "Continue with Quillmarc" goes to `BILLING_URL` (a payment link) or emails `CONTACT_EMAIL`.

Put your email in `ADMIN_EMAILS`. You then see **Accounts** in the sidebar (`/admin`): every account,
its trial, whether Stripe is connected, investors and updates sent, with **Activate**, **Add 14 days**
and **End access**. Take payment however you like, then click Activate.

## Testing with a Stripe sandbox

You do not need a live Stripe account to build or test. Founders connect their own Stripe with a
read-only restricted key, and a sandbox behaves exactly like live.

1. In your Stripe sandbox, create a restricted key (Customers, Subscriptions, Prices, Invoices and
   Charges set to Read) and connect it in Quillmarc. `rk_test_` keys are accepted.
2. Fill the sandbox with fictional customers, using its secret key once (never stored):
   `cd web && STRIPE_SANDBOX_SECRET_KEY=sk_test_... npm run stripe:sandbox`
   This creates about 30 customers covering every metric case: monthly, annual, weekly, seats, both
   kinds of discount, new this month, trials, cancellations, paused, a euro customer, usage-based
   and a declined card. Start dates are backdated over the past year.
3. Stripe cannot backdate cancellations. To build up real churn history, run
   `npm run stripe:sandbox -- --month` once a month (or a few times to fast-forward): some customers
   leave, one upgrades, a few join.
4. `npm run stripe:sandbox -- --reset` removes everything the script made.
5. For a realistic company with real history, run `npm run stripe:history` with the same key. It uses
   Stripe test clocks to live through 18 months: about 100 customers join at a growing pace, change
   plans, add seats, keep early discounts, take trials, and cancel at about 3% a month, each change
   recorded in the month it happened. It takes a few minutes. Stripe deletes test clocks and their
   customers after 30 days, so run it again to rebuild (`--reset` first). It only ever deletes clocks
   named "quillmarc history". Stripe hides test-clock subscriptions from normal lists, so with a
   sandbox key Quillmarc also reads them clock by clock; give the restricted key Read access to
   **Test clocks** too. Stripe dates every payment with the real date, so the Payments page shows
   them on the day they were made; subscriptions carry the simulated dates, which is what Quillmarc
   uses. `npm run stripe:history -- --plan` prints the numbers Quillmarc should show.

A founder with no key to hand can choose **Explore with sample data** during setup. Every screen
and email then says "Sample data", and they switch to their own Stripe in Settings.

## Run locally

```sh
cd web
cp .env.example .env.local   # fill in Supabase values; leave EMAIL_PROVIDER=mock
npm install
npm run dev                  # http://localhost:3000
```

With `EMAIL_PROVIDER=mock` nothing is emailed. The status page then shows a "Simulate events" button.

No Supabase project yet? `npm run build && npm run stack` runs the app at http://127.0.0.1:3100 against
a throwaway local Postgres and PostgREST with mock email and the seeded sample account (Linux x64, needs
Postgres server binaries). Its session is in `.cache/e2e-session.json`; the e2e test uses it to sign in.

## Test

```sh
npm run lint && npm run typecheck
npm test                 # unit + integration (metrics, Stripe adapter, crypto, tokens, status,
                         # Svix, email rendering, RLS isolation, delete cascade, queue idempotency,
                         # webhooks with recorded payloads, tracking)
npm run build && npm run test:e2e   # browser smoke test and accessibility pass, mock email
```

Integration tests start their own Postgres (needs `initdb` and `pg_ctl` on the PATH or in
`/usr/lib/postgresql`) and download PostgREST once into `.cache/bin`. Without them they skip and say so.
Set `PLAYWRIGHT_CHROMIUM_PATH` if Playwright should use an existing Chromium.

## Where things are

| Path | What |
| --- | --- |
| `src/lib/metrics/` | Metric calculation (pure) and how figures are labelled |
| `src/lib/stripe/` | Stripe adapter: interface, restricted-key source, sample source, normaliser, payments (`charges.ts`) |
| `src/lib/periods.ts`, `analytics.ts`, `revenue.ts` | Update periods, dashboard figures, the saved revenue history and its live refresh |
| `src/lib/sending/` | Send queue, status derivation, mock event simulator |
| `src/lib/webhooks/` | Svix verification and Resend event ingest |
| `src/lib/email/` | Email providers (Resend, mock) and the HTML and text email |
| `src/lib/actions/` | Server actions for setup and updates |
| `src/app/` | Pages and API routes |
| `supabase/migrations/` | Schema, row level security, grants |
| `scripts/` | Seed, local stack |

## Extension points (not built)

- Stripe Connect OAuth: add a `BillingSource` in `src/lib/stripe/adapter.ts`.
- Own-domain sending: `fromAddress` in `src/lib/sending/queue.ts`.
- Monthly reminders: a Vercel cron calling a new route that lists founders without an update.
- Billing, AI rewriting, teammates, PDF export: none.
