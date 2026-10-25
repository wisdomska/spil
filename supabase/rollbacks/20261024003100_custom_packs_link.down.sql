-- Reverses 20261024003100_custom_packs_link.sql. Afterwards run
--   supabase migration repair --status reverted 20261024003100
-- Warning: restoring the foreign key makes the rooms-with-pack query ambiguous again; only roll
-- this back together with 20261024003000.
drop trigger if exists rooms_delete_custom_packs on public.rooms;
drop function if exists public.delete_room_custom_packs();
