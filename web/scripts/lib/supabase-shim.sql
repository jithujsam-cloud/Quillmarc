-- A minimal stand-in for the parts of Supabase that the migrations rely on.
-- Used only by local tests and the local stack. Never run this against a real Supabase project.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator login noinherit password 'authenticator'; exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to authenticator;

create schema if not exists auth;
create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text,
  created_at timestamptz not null default now()
);

-- Same contract as Supabase: the user id comes from the JWT claims PostgREST sets per request.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on auth.users to service_role;

-- Supabase grants everything in public to these roles by default. Mirror that so the
-- migrations' revokes and column grants are what actually protects the data.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
