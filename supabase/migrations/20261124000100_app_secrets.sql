-- Keys the server makes for itself (owner request 2026-11-24): the Web Push (VAPID) key pair is
-- created on first use and kept here, so push notifications work without setting environment
-- variables in Vercel. Server only: RLS on, no policies, no grants to players or visitors.
-- Rollback: supabase/rollbacks/20261124000100_app_secrets.down.sql

create table public.app_secrets (
  key text primary key check (char_length(key) <= 100),
  value text not null check (char_length(value) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
comment on table public.app_secrets is 'Server-made keys (VAPID). Server only (no RLS policies on purpose).';
