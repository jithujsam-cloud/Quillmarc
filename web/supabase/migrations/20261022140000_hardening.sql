-- Hardening from the Supabase advisors. No change to who can see what.

-- 1. rls_auto_enable() is an event trigger the project template adds. Event triggers do not need EXECUTE,
--    so nobody outside the database should be able to call it through /rest/v1/rpc.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- 2. Evaluate auth.uid() once per query, not once per row. Same rules, faster at scale.
alter policy "own profile: select" on public.profiles using (id = (select auth.uid()));
alter policy "own profile: update" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "own connection: select" on public.stripe_connections using (user_id = (select auth.uid()));
alter policy "own investors: select" on public.investors using (user_id = (select auth.uid()));
alter policy "own investors: insert" on public.investors with check (user_id = (select auth.uid()));
alter policy "own investors: update" on public.investors
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "own investors: delete" on public.investors using (user_id = (select auth.uid()));
alter policy "own suppressions: select" on public.suppressions using (user_id = (select auth.uid()));
alter policy "own updates: select" on public.updates using (user_id = (select auth.uid()));
alter policy "own updates: insert" on public.updates with check (user_id = (select auth.uid()));
alter policy "own draft updates: update" on public.updates
  using (user_id = (select auth.uid()) and status = 'draft')
  with check (user_id = (select auth.uid()) and status = 'draft');
alter policy "own draft updates: delete" on public.updates
  using (user_id = (select auth.uid()) and status = 'draft');
alter policy "own sends: select" on public.sends using (user_id = (select auth.uid()));
alter policy "own events: select" on public.events using (user_id = (select auth.uid()));

-- 3. Index the foreign keys that account deletion and investor removal cascade through.
create index if not exists events_user_idx on public.events (user_id);
create index if not exists sends_user_idx on public.sends (user_id);
create index if not exists sends_investor_idx on public.sends (investor_id);
