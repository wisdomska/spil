-- Reverses 20261024000900_answer_progress.sql. Safe: answers stay in public.answers; the dropped
-- columns only cached a count and a timestamp. Afterwards run
--   supabase migration repair --status reverted 20261024000900
drop function if exists public.save_answers(uuid, uuid, int, jsonb);
alter table public.players
  drop column if exists last_answer_at,
  drop column if exists answered_count;
