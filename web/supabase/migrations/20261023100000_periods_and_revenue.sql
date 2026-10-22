-- Updates for any period (month, quarter, year, custom range), daily revenue history,
-- frozen monthly metric snapshots, and the investor total recorded at send time.

-- ---------------------------------------------------------------------------
-- updates: a period instead of only a month
-- ---------------------------------------------------------------------------
alter table public.updates
  add column period_type   text not null default 'month' check (period_type in ('month', 'quarter', 'year', 'custom')),
  add column period_start  date,
  add column period_end    date,       -- inclusive
  add column investor_total integer check (investor_total is null or investor_total >= 0);

-- Existing monthly updates keep working: the period is that month.
update public.updates
   set period_start = month,
       period_end   = (month + interval '1 month' - interval '1 day')::date;

-- Sent updates: the best record of "how many investors" is the sends that were made.
update public.updates u
   set investor_total = (select count(*) from public.sends s where s.update_id = u.id)
 where u.status in ('sending', 'sent');

alter table public.updates
  alter column period_start set not null,
  alter column period_end set not null,
  add constraint updates_period_order check (period_end >= period_start),
  -- A custom range covers at most 24 months. Month, quarter and year are shorter by construction.
  add constraint updates_period_length check (period_end - period_start <= 731);

-- `month` stays as the first day of the period's first month, so older code and links keep working.
alter table public.updates drop constraint updates_user_id_month_key;
create unique index updates_user_period_key on public.updates (user_id, period_type, period_start, period_end);

-- Keep `month` and the period in step, and let a plain monthly insert (only `month`) still work.
create function public.updates_fill_period() returns trigger language plpgsql as $$
begin
  if new.period_start is null then
    new.period_start := new.month;
    new.period_end := (new.month + interval '1 month' - interval '1 day')::date;
  end if;
  if new.period_end is null then
    new.period_end := new.period_start;
  end if;
  new.month := date_trunc('month', new.period_start)::date;
  return new;
end;
$$;
create trigger updates_fill_period before insert on public.updates
  for each row execute function public.updates_fill_period();

-- The browser may create a draft with a period. Totals and times are set by the server.
grant insert (period_type, period_start, period_end) on public.updates to authenticated;

-- ---------------------------------------------------------------------------
-- revenue_daily: cash collected per day, from Stripe charges, net of refunds.
-- Old days are never read from Stripe again; only the recent window is refreshed.
-- ---------------------------------------------------------------------------
create table public.revenue_daily (
  user_id   uuid not null references auth.users (id) on delete cascade,
  day       date not null,
  currency  text not null check (char_length(currency) = 3),
  gross     bigint not null default 0 check (gross >= 0),
  refunds   bigint not null default 0 check (refunds >= 0),
  payments  integer not null default 0 check (payments >= 0),
  primary key (user_id, day, currency)
);

-- ---------------------------------------------------------------------------
-- revenue_sync: where the import and the live refresh have got to, one row per user
-- ---------------------------------------------------------------------------
create table public.revenue_sync (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  last_synced_at      timestamptz,
  last_deep_at        timestamptz,        -- last time the trailing window was re-read for refunds
  backfill_before     timestamptz,        -- the import has covered everything from here to now
  backfill_complete   boolean not null default false,
  locked_until        timestamptz,        -- a sync in progress holds this, so two never overlap
  last_error          text
);

-- ---------------------------------------------------------------------------
-- metrics_snapshots: the numbers of a closed month, frozen when first calculated
-- ---------------------------------------------------------------------------
create table public.metrics_snapshots (
  user_id       uuid not null references auth.users (id) on delete cascade,
  month         date not null check (extract(day from month) = 1),
  metrics_json  jsonb not null,
  computed_at   timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.revenue_daily enable row level security;
alter table public.revenue_sync enable row level security;
alter table public.metrics_snapshots enable row level security;

revoke all on public.revenue_daily, public.revenue_sync, public.metrics_snapshots from anon, authenticated;

-- Founders read their own history. The server writes it.
grant select on public.revenue_daily to authenticated;
grant select (user_id, last_synced_at, backfill_complete, last_error) on public.revenue_sync to authenticated;
grant select on public.metrics_snapshots to authenticated;
create policy "own revenue: select" on public.revenue_daily for select to authenticated using (user_id = auth.uid());
create policy "own sync: select" on public.revenue_sync for select to authenticated using (user_id = auth.uid());
create policy "own snapshots: select" on public.metrics_snapshots for select to authenticated using (user_id = auth.uid());
