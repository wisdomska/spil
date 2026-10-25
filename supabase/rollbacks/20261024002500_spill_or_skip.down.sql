-- Reverses 20261024002500_spill_or_skip.sql. Afterwards run
--   supabase migration repair --status reverted 20261024002500
drop function if exists public.notify_room(uuid, text);
