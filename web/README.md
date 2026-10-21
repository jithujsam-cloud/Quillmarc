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
| `src/lib/stripe/` | Stripe adapter: interface, restricted-key source, sample source, normaliser |
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
- Billing, AI rewriting, teammates, PDF export, history charts: none.
