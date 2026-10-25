-- Reverses 20261024002600_party_mode.sql. Afterwards run
--   supabase migration repair --status reverted 20261024002600
alter table public.rooms drop column if exists tv_token;
