-- Rooms, players and per-round game data. See docs/TECH_SPEC.md section 9.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code char(4) not null check (code ~ '^[A-HJ-NP-Z2-9]{4}$'),
  pack_id text not null references public.packs (id),
  status public.room_status not null default 'lobby',
  round int not null default 1 check (round >= 1),
  final_round int not null default 0 check (final_round >= 0),  -- idempotency guard for finalize
  host_player_id uuid,
  created_by uuid not null,                                     -- auth.uid() of the creator
  created_at timestamptz not null default now(),
  started_at timestamptz,
  guessing_at timestamptz,
  ready_at timestamptz,
  revealed_at timestamptz,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create unique index rooms_code_live on public.rooms (code) where status <> 'closed';
create index rooms_pack_id_idx on public.rooms (pack_id);
create index rooms_host_player_id_idx on public.rooms (host_player_id);
create index rooms_created_by_idx on public.rooms (created_by);
create index rooms_expires_at_idx on public.rooms (expires_at);
create index rooms_lobby_created_at_idx on public.rooms (created_at) where status = 'lobby';

create trigger rooms_set_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();

create table public.room_questions (
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null,
  position int not null check (position >= 1),
  question_id uuid not null references public.questions (id),
  primary key (room_id, round, position),
  unique (room_id, round, question_id)
);
create index room_questions_question_id_idx on public.room_questions (question_id);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null,
  nickname text not null check (char_length(nickname) between 2 and 20),
  avatar smallint not null check (avatar between 0 and 23),
  rotation_seed int not null,                  -- picks sticker tilt
  age_confirmed boolean not null default false,
  is_bot boolean not null default false,       -- test players, non-prod only
  status public.player_status not null default 'active',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  answers_submitted_at timestamptz,
  guesses_submitted_at timestamptz,
  spill_mode boolean not null default false,   -- reset to false every round
  hide_name_on_card boolean not null default false,
  unique (room_id, user_id)
);
-- Nicknames are unique among players still in the game (sat_out players come
-- back as active on the next round, so they keep their name).
create unique index players_nick_unique on public.players (room_id, lower(nickname)) where status in ('active', 'sat_out');
create index players_user_id_idx on public.players (user_id);

alter table public.rooms
  add constraint rooms_host_fk foreign key (host_player_id) references public.players (id) on delete set null;

create table public.answers (
  player_id uuid not null references public.players (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null,
  question_id uuid not null references public.questions (id),
  value public.answer_value not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, round, question_id)
);
create index answers_room_id_round_idx on public.answers (room_id, round);
create index answers_question_id_idx on public.answers (question_id);

create trigger answers_set_updated_at before update on public.answers
  for each row execute function public.set_updated_at();

create table public.guesses (
  guesser_id uuid not null references public.players (id) on delete cascade,
  target_id uuid not null references public.players (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null,
  value smallint not null check (value between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (guesser_id, target_id, round),
  check (guesser_id <> target_id)
);
create index guesses_target_id_idx on public.guesses (target_id);
create index guesses_room_id_round_idx on public.guesses (room_id, round);

create trigger guesses_set_updated_at before update on public.guesses
  for each row execute function public.set_updated_at();

create table public.results (
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null,
  player_id uuid not null references public.players (id) on delete cascade,
  spill_score smallint not null check (spill_score between 0 and 100),
  label text not null,
  avg_guess_about smallint not null,
  mind_reader smallint not null,
  rank smallint not null,
  primary key (room_id, round, player_id)
);
create index results_player_id_idx on public.results (player_id);

create table public.awards (
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null,
  award text not null,                         -- 'top_spiller' etc.
  player_id uuid not null references public.players (id) on delete cascade,
  reason text not null,
  position smallint not null,
  primary key (room_id, round, award)
);
create index awards_player_id_idx on public.awards (player_id);
