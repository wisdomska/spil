-- Push notifications (owner request 2026-11-23, modelled on Clink): one row per phone or
-- browser that allowed notifications. The server sends game updates (the game started, the
-- reveal is ready, a rematch) and the Today's Spill reminder. Server only: RLS on, no policies.
-- Rollback: supabase/rollbacks/20261123000100_push_subscriptions.down.sql

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  ua text check (char_length(ua) <= 200),
  -- What this device wants: game updates from rooms it is in, and the daily reminder.
  game_updates boolean not null default true,
  daily boolean not null default true,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
comment on table public.push_subscriptions is 'Web Push subscriptions. Server only (no RLS policies on purpose).';
