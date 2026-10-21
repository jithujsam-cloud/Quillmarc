# Quillmarc

Waitlist site for Quillmarc: your monthly investor update, written from your Stripe numbers. Said "quill mark", spelled with a c.

Static pages plus three dependency-free Vercel functions. No build step.

| Path | What it is |
| --- | --- |
| `/` | Landing page with the two-step waitlist form and a headline A/B test |
| `/thanks` | Confirms the spot, asks MRR range and the biggest headache, offers a call and a share link |
| `/privacy`, `/terms` | Plain-English drafts. Review before launch. |
| `/brand` | Brand guidelines. Unlisted and `noindex`. |
| `/api/join` | Validates, rate limits, de-duplicates, stores the signup, sends the welcome email |
| `/api/answers` | Saves thank-you answers onto the same row, by one-time token |
| `/config.js` | Public settings from env vars (served by `/api/config`) |

## Run locally

```sh
cp .env.example .env.local   # fill in what you have
node scripts/dev.js          # http://localhost:3000
```

`scripts/dev.js` mimics Vercel: clean URLs, the `/config.js` rewrite, `/api` functions and gzip.

## Deploy

1. Vercel: import the repo, framework "Other", no build command.
2. Supabase: create a project, then run both files in `supabase/migrations/` in order.
3. Add the env vars from `.env.example` in Vercel. Only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required for signups to save. Email, analytics, booking link and photo switch on when their vars are set.
4. When the custom domain is live, update `SITE_URL` and the hard-coded canonical spots: the `<link rel="canonical">` and Open Graph URLs in the HTML pages, `sitemap.xml` and `robots.txt`.

Read signups:

```sql
select created_at, email, company, investor_count, current_method, mrr_range, pain_point,
       variant, utm_source, utm_medium, utm_campaign, referrer, call_clicked_at
from public.waitlist order by created_at;
```

Founding members are the first 100 rows by `id`.

## Brand assets

`assets/logo/` holds the wordmark (the pen-written Q, gold squares at its tail and on the i) in ink, reverse, sapphire and one-colour versions, the Q symbol, app icons and a theme-aware favicon. Regenerate with `python3 brand/tools/build_logos.py`; it also rewrites the inline logo in every page. The share image and PNG icons come from `node brand/tools/render_images.js`.

Palette: Midnight Navy #102542, Sapphire #1E3A5F, Champagne #D8C3A5, Ivory #FAF8F5, Gilt gold #DDB040. Tokens live in `brand/tokens.css`.

## Records

- `AUDIT.md`: the expert audit, with what was fixed.
- `DECISIONS.md`: every judgment call and why.
- `.env.example`: every environment variable.
