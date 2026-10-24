-- Game modes (owner features, Batch 1). A room plays one mode; classic is SPIL as it was. Every
-- mode's per-player input (a percentage guess, a vote, a rank, a pick, written text) lands in
-- mode_inputs, so new modes need no new tables. Points are stored when the round is revealed.
-- Rollback: supabase/rollbacks/20261024001600_game_modes.down.sql

alter table public.rooms
  add column mode text not null default 'classic'
    check (mode in ('classic', 'room_percentage', 'hot_takes', 'most_likely', 'red_green',
                    'rank_room', 'imposter', 'two_truths', 'who_said', 'spill_or_skip'));

create table public.mode_inputs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null,
  player_id uuid not null references public.players (id) on delete cascade,
  kind text not null check (kind in ('percent', 'rating', 'vote', 'rank', 'pick', 'text')),
  question_id uuid references public.questions (id) on delete cascade,
  target_id uuid references public.players (id) on delete cascade,
  value smallint check (value between 0 and 100),
  body text check (char_length(body) <= 140),
  points smallint check (points between 0 and 13),
  closest boolean not null default false,
  updated_at timestamptz not null default now()
);
-- One input per player, round, kind, question and target.
create unique index mode_inputs_one_per_slot on public.mode_inputs (
  player_id, round, kind,
  coalesce(question_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index mode_inputs_room_round_idx on public.mode_inputs (room_id, round);

create trigger mode_inputs_set_updated_at before update on public.mode_inputs
  for each row execute function public.set_updated_at();

-- Same rules as guesses: a player reads their own; the room reads everyone's after the reveal.
-- Only the API (service role) writes.
alter table public.mode_inputs enable row level security;
revoke all on public.mode_inputs from anon, authenticated;
grant select on public.mode_inputs to authenticated;
create policy mode_inputs_select_own on public.mode_inputs
  for select to authenticated
  using (player_id in (select public.current_player_ids()));
create policy mode_inputs_select_revealed on public.mode_inputs
  for select to authenticated
  using (public.is_room_revealed(room_id));
