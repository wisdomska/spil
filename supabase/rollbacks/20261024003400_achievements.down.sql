-- Reverses 20261024003400_achievements.sql. Afterwards run
--   supabase migration repair --status reverted 20261024003400
-- Deletes everyone's badge progress and chosen frames and looks.
drop function if exists public.record_round_stats(jsonb);
drop table if exists public.player_stats;
