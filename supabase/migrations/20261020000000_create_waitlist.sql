-- Quillmark waitlist.
-- The public (anon) role may insert rows and nothing else: no select, update or delete.

create table if not exists public.waitlist (
  id              bigint generated always as identity primary key,
  email           text        not null check (char_length(email) between 3 and 254 and email like '%_@_%._%'),
  company         text        not null check (char_length(btrim(company)) between 1 and 120),
  investor_count  text        not null check (investor_count in ('1-10', '11-30', '31-100', '100+')),
  current_method  text        not null check (current_method in ('visible', 'plain_email', 'other', 'not_sending')),
  referrer        text        check (referrer is null or char_length(referrer) <= 500),
  created_at      timestamptz not null default now()
);

create unique index if not exists waitlist_email_lower_key on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

revoke all on public.waitlist from anon, authenticated;
grant insert (email, company, investor_count, current_method, referrer) on public.waitlist to anon;

drop policy if exists "anon can join waitlist" on public.waitlist;
create policy "anon can join waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);
