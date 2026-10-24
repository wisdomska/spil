-- Owner decision 2026-10-24: a room can start with 1 player (solo). With nobody else to guess
-- about, the game skips guessing and the results leave out the room's guess, Mind Reader points
-- and awards. The admin can still raise the minimum.
-- Rollback: supabase/rollbacks/20261024001500_solo_play.down.sql
alter table public.settings drop constraint if exists settings_min_players_check;
alter table public.settings
  add constraint settings_min_players_check check (min_players between 1 and 20);
alter table public.settings alter column min_players set default 1;
update public.settings set min_players = 1 where min_players = 2;
