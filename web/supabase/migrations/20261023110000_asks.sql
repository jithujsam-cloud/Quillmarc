-- Asks: what the founder is asking investors for (an intro, feedback, a hire), tracked until it is done.
-- Open asks carry into the next update draft.

create table public.asks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- The investor who might help. Empty means "anyone". Removing the investor keeps the ask.
  investor_id  uuid references public.investors (id) on delete set null,
  text         text not null check (char_length(text) between 1 and 500),
  owner        text check (owner is null or char_length(owner) between 1 and 80),
  status       text not null default 'open' check (status in ('open', 'intro_made', 'done')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index asks_user_status_idx on public.asks (user_id, status, created_at desc);
create index asks_investor_idx on public.asks (investor_id);

alter table public.asks enable row level security;
revoke all on public.asks from anon, authenticated;

grant select, delete on public.asks to authenticated;
grant insert (user_id, investor_id, text, owner) on public.asks to authenticated;
grant update (investor_id, text, owner, status, resolved_at, updated_at) on public.asks to authenticated;

-- An ask can only name one of the founder's own investors.
create policy "own asks: select" on public.asks for select to authenticated using (user_id = (select auth.uid()));
create policy "own asks: insert" on public.asks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (investor_id is null or exists (select 1 from public.investors i where i.id = investor_id and i.user_id = (select auth.uid())))
  );
create policy "own asks: update" on public.asks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (investor_id is null or exists (select 1 from public.investors i where i.id = investor_id and i.user_id = (select auth.uid())))
  );
create policy "own asks: delete" on public.asks for delete to authenticated using (user_id = (select auth.uid()));
