-- Reverses 20261024003300_premium_packs.sql. Afterwards run
--   supabase migration repair --status reverted 20261024003300
alter table public.packs drop column if exists premium;
