-- Series score (SPIL-18). Rounds in a room count towards its series from series_start; the
-- host's "Reset series" moves it past the current round. Wins are computed from results.
-- Rollback: supabase/rollbacks/20261024003500_series.down.sql

alter table public.rooms add column series_start int not null default 1 check (series_start >= 1);
