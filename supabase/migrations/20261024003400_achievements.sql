-- Achievements and cosmetics (Batch 3, free): stats per device session, added to at every reveal,
-- from which badges unlock avatar frames and share card looks. Only the API writes; a player can
-- read their own row. Nothing here holds answers.
-- Rollback: supabase/rollbacks/20261024003400_achievements.down.sql

create table public.player_stats (
  user_id uuid primary key,
  games int not null default 0 check (games >= 0),
  wins int not null default 0 check (wins >= 0),
  bullseyes int not null default 0 check (bullseyes >= 0),
  hosted int not null default 0 check (hosted >= 0),
  points int not null default 0 check (points >= 0),
  modes text[] not null default '{}',
  frame text not null default 'none' check (frame in ('none', 'ring', 'accent', 'dashed', 'double')),
  look text not null default 'night' check (look in ('night', 'raised', 'accent')),
  updated_at timestamptz not null default now()
);
alter table public.player_stats enable row level security;
create policy player_stats_select_own on public.player_stats
  for select to authenticated using (user_id = auth.uid());
revoke all on public.player_stats from anon, authenticated;
grant select on public.player_stats to authenticated;

-- Adds one round per row: [{user_id, games, wins, bullseyes, hosted, points, mode}].
create function public.record_round_stats(p_rows jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.player_stats as s (user_id, games, wins, bullseyes, hosted, points, modes)
  select (r ->> 'user_id')::uuid,
         coalesce((r ->> 'games')::int, 0),
         coalesce((r ->> 'wins')::int, 0),
         coalesce((r ->> 'bullseyes')::int, 0),
         coalesce((r ->> 'hosted')::int, 0),
         coalesce((r ->> 'points')::int, 0),
         array[r ->> 'mode']
  from jsonb_array_elements(p_rows) r
  on conflict (user_id) do update set
    games = s.games + excluded.games,
    wins = s.wins + excluded.wins,
    bullseyes = s.bullseyes + excluded.bullseyes,
    hosted = s.hosted + excluded.hosted,
    points = s.points + excluded.points,
    modes = (select array_agg(distinct m) from unnest(s.modes || excluded.modes) m),
    updated_at = now();
end;
$$;
revoke execute on function public.record_round_stats(jsonb) from public, anon, authenticated;
grant execute on function public.record_round_stats(jsonb) to service_role;
