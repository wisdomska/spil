-- Reverses 20261026000100_profiles.sql. Afterwards run
--   supabase migration repair --status reverted 20261026000100
-- Drops every username and recovery code. The auth users keep their placeholder emails and
-- passwords but can no longer sign in through SPIL.
drop function if exists public.delete_account_data(uuid);
drop function if exists public.merge_guest_progress(uuid, uuid);
drop table if exists public.profiles;
delete from public.captcha_events where endpoint = 'account';
alter table public.captcha_events drop constraint captcha_events_endpoint_check;
alter table public.captcha_events add constraint captcha_events_endpoint_check
  check (endpoint in ('create_room', 'contact'));
