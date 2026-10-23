-- Owner decision 2026-10-23: rooms can start with 2 players (was 3). The admin can still raise it.
-- Question stats keep their own threshold of 3 answers (lib/game/results.ts), so a 2-player room
-- never shows a yes count that would reveal the other player's answer.
alter table public.settings drop constraint if exists settings_min_players_check;
alter table public.settings
  add constraint settings_min_players_check check (min_players between 2 and 20);
alter table public.settings alter column min_players set default 2;
update public.settings set min_players = 2 where min_players = 3;
