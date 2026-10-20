# Quillmark waitlist

Static landing page for Quillmark (working name): monthly investor updates written from live Stripe data.

No build step. `index.html`, `styles.css`, `app.js` and `config.js` deploy as-is to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/20261020000000_create_waitlist.sql` (SQL editor, or `supabase db push`).
   It creates `public.waitlist` with row level security: the public key can insert, and cannot read, update or delete.
3. Put the project URL and publishable (anon) key in `config.js`.

Submissions go straight to the Supabase REST API (`POST /rest/v1/waitlist`). A repeat email counts as success, so people who sign up twice see the same calm confirmation. A hidden honeypot field drops simple bots.

Read signups in the Supabase dashboard, or with the service role:

```sql
select created_at, email, company, investor_count, current_method from public.waitlist order by created_at desc;
```

## Brand assets

- `assets/logo/quillmark-mark-ink.svg`: mark in ink (#16201C), for light backgrounds
- `assets/logo/quillmark-mark-reverse.svg`: mark in reverse (#F7F3EA), for dark or brand green backgrounds
- `assets/logo/quillmark-mark-reverse-on-green.svg`: reverse mark on a brand green tile (favicon, avatars)

In the page, the mark is an inline SVG symbol using `currentColor`, set beside the wordmark in Newsreader.
