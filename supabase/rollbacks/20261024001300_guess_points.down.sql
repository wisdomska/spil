-- Reverses 20261024001300_guess_points.sql. Per-guess points are dropped; results.mind_reader
-- keeps each round's totals. Afterwards run
--   supabase migration repair --status reverted 20261024001300
alter table public.guesses drop column if exists closest, drop column if exists points;
