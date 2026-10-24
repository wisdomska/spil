-- Reverses 20261024001500_solo_play.sql: back to a minimum of 2 players. Afterwards run
--   supabase migration repair --status reverted 20261024001500
update public.settings set min_players = 2 where min_players < 2;
alter table public.settings drop constraint if exists settings_min_players_check;
alter table public.settings
  add constraint settings_min_players_check check (min_players between 2 and 20);
alter table public.settings alter column min_players set default 2;
