-- Reverses 20261024001200_captcha_events.sql. Drops the failed bot check log (diagnostics only).
-- Afterwards run
--   supabase migration repair --status reverted 20261024001200
drop table if exists public.captcha_events;
