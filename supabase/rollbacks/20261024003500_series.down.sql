-- Reverses 20261024003500_series.sql. Afterwards run
--   supabase migration repair --status reverted 20261024003500
alter table public.rooms drop column if exists series_start;
