-- Stripe Connect (OAuth, read_only scope) as a second way to connect Stripe.
-- The founder approves Quillmarc on Stripe's own page. We store only the connected account id;
-- requests use the platform's secret key with a Stripe-Account header, limited by the read_only scope.

alter table public.stripe_connections drop constraint stripe_connections_method_check;
alter table public.stripe_connections
  add constraint stripe_connections_method_check check (method in ('restricted_key', 'sample', 'oauth'));

alter table public.stripe_connections
  add column stripe_account_id text check (stripe_account_id is null or stripe_account_id ~ '^acct_[A-Za-z0-9]+$');

-- One connection must carry what its method needs.
alter table public.stripe_connections
  add constraint stripe_connections_method_fields check (
    (method = 'restricted_key' and encrypted_key is not null)
    or (method = 'oauth' and stripe_account_id is not null)
    or method = 'sample'
  );

-- The account id is not a secret, but the browser has no use for it. Server only, like the key.

-- The Stripe account's display name, shown in Settings so the founder can see which account is linked.
alter table public.stripe_connections
  add column account_name text check (account_name is null or char_length(account_name) <= 200);
grant select (account_name) on public.stripe_connections to authenticated;
