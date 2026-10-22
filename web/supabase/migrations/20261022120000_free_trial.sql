-- Free trial instead of a waitlist. Every new account gets 14 days with everything on.
-- plan: trial (until trial_ends_at), active (paid or switched on by the owner), ended (access stopped).
-- Founders can read both columns but not change them: the profiles update grant lists only
-- founder_name, company_name, reply_to_email and updated_at. The admin page changes them with the service role.

alter table public.profiles
  add column plan text not null default 'trial' check (plan in ('trial', 'active', 'ended')),
  add column trial_ends_at timestamptz not null default (now() + interval '14 days');
