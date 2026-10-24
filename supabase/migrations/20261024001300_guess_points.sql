-- SPIL-09: banded Mind Reader points are stored on each guess when the round is revealed, so a
-- finished round never changes if the scoring is tuned later. Older rounds keep null here and
-- their stored results.mind_reader.
-- Rollback: supabase/rollbacks/20261024001300_guess_points.down.sql

alter table public.guesses
  add column points smallint check (points between 0 and 13),
  add column closest boolean not null default false;
