-- Reverses 20261024001600_game_modes.sql. Mode inputs are dropped; rooms go back to classic only.
-- Afterwards run
--   supabase migration repair --status reverted 20261024001600
drop table if exists public.mode_inputs;
alter table public.rooms drop column if exists mode;
