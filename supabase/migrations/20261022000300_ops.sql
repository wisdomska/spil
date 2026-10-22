-- Moderation, admin and operational tables. See docs/TECH_SPEC.md section 9.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  type public.report_type not null,
  question_id uuid references public.questions (id) on delete set null,
  player_id uuid references public.players (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  reason text not null check (char_length(reason) <= 280),
  reporter_user_id uuid not null,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create index reports_question_id_idx on public.reports (question_id);
create index reports_player_id_idx on public.reports (player_id);
create index reports_room_id_idx on public.reports (room_id);
create index reports_status_created_at_idx on public.reports (status, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  name text check (char_length(name) <= 60),
  email text check (char_length(email) <= 120),
  body text not null check (char_length(body) between 5 and 2000),
  status public.message_status not null default 'new',
  created_at timestamptz not null default now()
);
create index messages_status_created_at_idx on public.messages (status, created_at desc);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  role public.admin_role not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_user_id uuid,
  who text not null,
  action text not null,
  target text not null,
  before jsonb,
  after jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_admin_user_id_idx on public.audit_log (admin_user_id);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
create index rate_limits_window_start_idx on public.rate_limits (window_start);

create table public.stats_daily (
  day date primary key,
  games_started int not null default 0,
  games_finished int not null default 0,
  joins int not null default 0
);

create table public.pack_plays (
  pack_id text not null references public.packs (id) on delete cascade,
  day date not null,
  started int not null default 0,
  primary key (pack_id, day)
);
