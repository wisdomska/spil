-- Reverses 20261105000100_admin_users.sql. Afterwards run
--   supabase migration repair --status reverted 20261105000100
-- Read-only functions: no data is lost.
drop function if exists public.admin_user_summary();
drop function if exists public.admin_accounts(text, text, int, int);
