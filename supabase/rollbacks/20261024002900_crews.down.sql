-- Reverses 20261024002900_crews.sql. Afterwards run
--   supabase migration repair --status reverted 20261024002900
-- Deletes every crew, its members and its round history.
alter table public.rooms drop column if exists crew_id;
drop table if exists public.crew_rounds;
drop table if exists public.crew_members;
drop table if exists public.crews;
drop function if exists public.is_crew_member(uuid);
