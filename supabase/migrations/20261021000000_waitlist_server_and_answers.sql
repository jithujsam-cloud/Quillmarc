-- Quillmarc waitlist, step two.
-- Signups now go through the server (/api/join) with the service role key, so the public
-- (anon) role loses its insert permission. New columns store attribution, the headline
-- variant, rate-limit and edit tokens, and the optional answers from the thank-you page.

alter table public.waitlist
  add column if not exists variant          text check (variant is null or variant in ('a', 'b')),
  add column if not exists utm_source       text check (utm_source is null or char_length(utm_source) <= 120),
  add column if not exists utm_medium       text check (utm_medium is null or char_length(utm_medium) <= 120),
  add column if not exists utm_campaign     text check (utm_campaign is null or char_length(utm_campaign) <= 120),
  add column if not exists utm_term         text check (utm_term is null or char_length(utm_term) <= 120),
  add column if not exists utm_content      text check (utm_content is null or char_length(utm_content) <= 120),
  add column if not exists landing_path     text check (landing_path is null or char_length(landing_path) <= 300),
  add column if not exists ip_hash          text,
  add column if not exists edit_token       uuid,
  add column if not exists mrr_range        text check (mrr_range is null or mrr_range in ('pre_revenue', 'under_10k', '10k_50k', '50k_250k', 'over_250k')),
  add column if not exists pain_point       text check (pain_point is null or char_length(pain_point) <= 1000),
  add column if not exists call_clicked_at  timestamptz,
  add column if not exists welcome_sent_at  timestamptz,
  add column if not exists updated_at       timestamptz;

create unique index if not exists waitlist_edit_token_key on public.waitlist (edit_token);
create index if not exists waitlist_ip_hash_created_idx on public.waitlist (ip_hash, created_at);

-- Server-only access from here on. Row level security stays on with no anon policy,
-- so the publishable key can no longer read or write this table.
drop policy if exists "anon can join waitlist" on public.waitlist;
revoke all on public.waitlist from anon, authenticated;
