-- Enums, content tables (packs, questions), settings and feature flags.
-- See docs/TECH_SPEC.md section 9.

create type public.pack_status as enum ('live', 'draft', 'hidden');
create type public.heat_level as enum ('spicy', 'explicit', 'intense');
create type public.pack_tone as enum ('accent', 'inverse', 'raised');
create type public.q_status as enum ('live', 'draft', 'hidden');
create type public.room_status as enum ('lobby', 'answering', 'guessing', 'ready', 'revealed', 'closed');
create type public.player_status as enum ('active', 'left', 'removed', 'sat_out');
create type public.answer_value as enum ('yes', 'no', 'skip');
create type public.report_type as enum ('question', 'nickname', 'other');
create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.message_status as enum ('new', 'read', 'archived');
create type public.admin_role as enum ('owner', 'content_lead', 'moderator');

-- Keeps updated_at current on every update.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.packs (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),  -- slug, e.g. 'classic'
  name text not null check (char_length(name) between 2 and 40),
  blurb text not null check (char_length(blurb) <= 140),
  icon text not null,                                   -- Phosphor icon name, e.g. 'cards'
  tone public.pack_tone not null default 'raised',
  is_adult boolean not null default false,
  heat public.heat_level,                               -- required when is_adult
  region text check (region in ('GH', 'NG')),
  status public.pack_status not null default 'draft',
  sort_order int not null default 100,
  updated_at timestamptz not null default now(),
  constraint packs_heat_matches_adult check ((is_adult and heat is not null) or (not is_adult and heat is null))
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null references public.packs (id) on delete cascade,
  text text not null check (char_length(text) between 8 and 120),  -- stored without "Have you ever"
  status public.q_status not null default 'live',
  yes_count int not null default 0 check (yes_count >= 0),
  answered_count int not null default 0 check (answered_count >= 0),
  report_count int not null default 0 check (report_count >= 0),
  updated_at timestamptz not null default now()
);
create index questions_pack_id_status_idx on public.questions (pack_id, status);

create table public.settings (
  id boolean primary key default true check (id),     -- singleton
  questions_per_game int not null default 12 check (questions_per_game between 5 and 100),
  max_players int not null default 12 check (max_players between 3 and 20),
  min_players int not null default 3 check (min_players between 3 and 20),
  updated_at timestamptz not null default now(),
  constraint settings_min_le_max check (min_players <= max_players)
);

-- keys: polling_only, adult_packs_enabled, test_players, payments_enabled, party_mode
create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false
);

create trigger packs_set_updated_at before update on public.packs
  for each row execute function public.set_updated_at();
-- Only content edits touch updated_at; answer stat counters do not.
create trigger questions_set_updated_at before update on public.questions
  for each row
  when (
    old.pack_id is distinct from new.pack_id
    or old.text is distinct from new.text
    or old.status is distinct from new.status
  )
  execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
