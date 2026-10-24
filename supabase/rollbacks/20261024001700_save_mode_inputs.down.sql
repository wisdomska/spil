-- Reverses 20261024001700_save_mode_inputs.sql. Afterwards run
--   supabase migration repair --status reverted 20261024001700
drop function if exists public.save_mode_inputs(uuid, uuid, int, text, jsonb);
