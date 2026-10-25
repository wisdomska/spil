-- Reverses 20261024002700_reactions.sql. Afterwards run
--   supabase migration repair --status reverted 20261024002700
drop function if exists public.send_reaction(uuid, uuid, text);
