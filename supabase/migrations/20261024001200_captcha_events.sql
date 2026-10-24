-- SPIL-05: failed bot checks, so the admin dashboard can show them. No IP and no user agent:
-- only Cloudflare's error codes, the hostname the token was made for, the browser family and
-- which endpoint asked.
-- Rollback: supabase/rollbacks/20261024001200_captcha_events.down.sql

create table public.captcha_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  endpoint text not null check (endpoint in ('create_room', 'contact')),
  error_codes text[] not null default '{}',
  hostname text,
  browser text not null default 'other'
    check (browser in ('chrome', 'safari', 'firefox', 'edge', 'other'))
);
create index captcha_events_created_at_idx on public.captcha_events (created_at desc);

-- Server only: written and read with the service role. No client access at all.
alter table public.captcha_events enable row level security;
revoke all on public.captcha_events from anon, authenticated;
