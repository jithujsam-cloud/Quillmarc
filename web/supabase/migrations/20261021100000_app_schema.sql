-- Quillmarc app schema.
-- Every table carries user_id and has row level security, so each founder sees only their own rows.
-- Every user_id references auth.users with on delete cascade: deleting the auth user deletes everything.
-- The browser (anon and authenticated roles) gets only the column grants listed here.
-- Secrets (the encrypted Stripe key) and delivery records are written by the server with the service role.

-- ---------------------------------------------------------------------------
-- profiles: sender details, one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  founder_name    text check (founder_name is null or char_length(founder_name) between 1 and 80),
  company_name    text check (company_name is null or char_length(company_name) between 1 and 80),
  reply_to_email  text check (reply_to_email is null or char_length(reply_to_email) between 3 and 254),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Create the profile row when a user signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- stripe_connections: one per user. The key is AES-256-GCM encrypted by the server.
-- ---------------------------------------------------------------------------
create table public.stripe_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users (id) on delete cascade,
  -- restricted_key: pasted read-only key. sample: labeled demo data from the seed script.
  -- Later: oauth (Stripe Connect, read_only scope).
  method           text not null check (method in ('restricted_key', 'sample')),
  encrypted_key    text,
  key_mode         text check (key_mode in ('test', 'live')),
  key_last4        text check (key_last4 is null or char_length(key_last4) = 4),
  status           text not null default 'connected' check (status in ('connected', 'error')),
  last_checked_at  timestamptz,
  last_error       text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- investors
-- ---------------------------------------------------------------------------
create table public.investors (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 120),
  email              text not null check (char_length(email) between 3 and 254),
  opted_out          boolean not null default false,
  opted_out_at       timestamptz,
  suppressed         boolean not null default false,
  suppressed_reason  text check (suppressed_reason is null or suppressed_reason in ('bounced', 'complained')),
  created_at         timestamptz not null default now()
);
create unique index investors_user_email_key on public.investors (user_id, lower(email));

-- Addresses that bounced or complained. Kept even if the investor row is deleted and re-added.
create table public.suppressions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text not null,
  reason      text not null check (reason in ('bounced', 'complained')),
  created_at  timestamptz not null default now()
);
create unique index suppressions_user_email_key on public.suppressions (user_id, lower(email));

-- ---------------------------------------------------------------------------
-- updates: one per user per month
-- ---------------------------------------------------------------------------
create table public.updates (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  month                  date not null check (extract(day from month) = 1),
  status                 text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  metrics_json           jsonb,
  adjustments_json       jsonb not null default '{}'::jsonb,
  bullets_json           jsonb not null default '{"wins": [], "problems": [], "asks": []}'::jsonb,
  excluded_investor_ids  uuid[] not null default '{}',
  copy_to_founder        boolean not null default false,
  copy_sent_at           timestamptz,
  test_sent_at           timestamptz,
  sent_at                timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, month)
);

-- ---------------------------------------------------------------------------
-- sends: one per investor per update. The unique pair makes enqueueing idempotent.
-- ---------------------------------------------------------------------------
create table public.sends (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  update_id          uuid not null references public.updates (id) on delete cascade,
  investor_id        uuid not null references public.investors (id) on delete cascade,
  investor_name      text not null,
  investor_email     text not null,
  token              text not null unique check (char_length(token) >= 40),
  resend_message_id  text unique,
  -- Pipeline state only. What the investor did is derived from events.
  -- skipped: the investor opted out or was suppressed between queueing and sending.
  status             text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts           integer not null default 0,
  last_error         text,
  claimed_at         timestamptz,
  sent_at            timestamptz,
  created_at         timestamptz not null default now(),
  unique (update_id, investor_id)
);
create index sends_update_status_idx on public.sends (update_id, status);

-- ---------------------------------------------------------------------------
-- events: every webhook event and every read of the hosted page
-- ---------------------------------------------------------------------------
create table public.events (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  send_id      uuid not null references public.sends (id) on delete cascade,
  type         text not null check (type in ('sent', 'delivered', 'delivery_delayed', 'opened', 'clicked',
                                             'bounced', 'complained', 'read', 'opted_out')),
  occurred_at  timestamptz not null,
  raw          jsonb,
  svix_id      text unique,
  created_at   timestamptz not null default now()
);
create index events_send_idx on public.events (send_id, occurred_at);

-- ---------------------------------------------------------------------------
-- rate_limits: fixed-window counters, server only
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (key, window_start)
);

-- Returns true when the call is allowed, false when the limit is hit.
create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c integer;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, w, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return c <= p_limit;
end;
$$;

-- Atomically claim queued sends (and sends stuck in 'sending' after a crash) for delivery.
-- skip locked lets two workers run without claiming the same row.
create function public.claim_sends(p_update_id uuid, p_limit integer, p_stale_seconds integer)
returns setof public.sends language sql security definer set search_path = public as $$
  update public.sends s
     set status = 'sending', claimed_at = now(), attempts = s.attempts + 1
   where s.id in (
     select id from public.sends
      where update_id = p_update_id
        and (status = 'queued'
             or (status = 'sending' and claimed_at < now() - make_interval(secs => p_stale_seconds)))
      order by created_at, id
      limit p_limit
      for update skip locked)
  returning s.*;
$$;

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.stripe_connections enable row level security;
alter table public.investors enable row level security;
alter table public.suppressions enable row level security;
alter table public.updates enable row level security;
alter table public.sends enable row level security;
alter table public.events enable row level security;
alter table public.rate_limits enable row level security;

revoke all on public.profiles, public.stripe_connections, public.investors, public.suppressions,
  public.updates, public.sends, public.events, public.rate_limits from anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_sends(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.claim_sends(uuid, integer, integer) to service_role;

-- profiles
grant select on public.profiles to authenticated;
grant update (founder_name, company_name, reply_to_email, updated_at) on public.profiles to authenticated;
create policy "own profile: select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile: update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- stripe_connections: read status only, never the encrypted key. Writes go through the server.
grant select (id, user_id, method, key_mode, key_last4, status, last_checked_at, last_error, created_at)
  on public.stripe_connections to authenticated;
create policy "own connection: select" on public.stripe_connections for select to authenticated
  using (user_id = auth.uid());

-- investors: opted_out and suppressed can only be set by the server.
grant select, delete on public.investors to authenticated;
grant insert (user_id, name, email) on public.investors to authenticated;
grant update (name, email) on public.investors to authenticated;
create policy "own investors: select" on public.investors for select to authenticated using (user_id = auth.uid());
create policy "own investors: insert" on public.investors for insert to authenticated with check (user_id = auth.uid());
create policy "own investors: update" on public.investors for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own investors: delete" on public.investors for delete to authenticated using (user_id = auth.uid());

-- suppressions: read only
grant select on public.suppressions to authenticated;
create policy "own suppressions: select" on public.suppressions for select to authenticated using (user_id = auth.uid());

-- updates: founders edit drafts. Status, test and send times are set by the server.
grant select, delete on public.updates to authenticated;
grant insert (user_id, month, metrics_json) on public.updates to authenticated;
grant update (metrics_json, adjustments_json, bullets_json, excluded_investor_ids, copy_to_founder, updated_at)
  on public.updates to authenticated;
create policy "own updates: select" on public.updates for select to authenticated using (user_id = auth.uid());
create policy "own updates: insert" on public.updates for insert to authenticated with check (user_id = auth.uid());
create policy "own draft updates: update" on public.updates for update to authenticated
  using (user_id = auth.uid() and status = 'draft') with check (user_id = auth.uid() and status = 'draft');
create policy "own draft updates: delete" on public.updates for delete to authenticated
  using (user_id = auth.uid() and status = 'draft');

-- sends and events: read only
grant select on public.sends to authenticated;
create policy "own sends: select" on public.sends for select to authenticated using (user_id = auth.uid());
grant select on public.events to authenticated;
create policy "own events: select" on public.events for select to authenticated using (user_id = auth.uid());

-- rate_limits: no policies, no grants. Server only.
