-- Fix for 20261024003000: a foreign key from packs.room_id to rooms gave PostgREST a second path
-- between rooms and packs, so the existing "rooms with their pack" query became ambiguous and
-- every room failed to load. The link is now a plain column, and a trigger deletes a room's own
-- pack (and its questions) when the room is deleted, as the foreign key did.
-- Rollback: supabase/rollbacks/20261024003100_custom_packs_link.down.sql

alter table public.packs drop constraint if exists packs_room_id_fkey;

create function public.delete_room_custom_packs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.packs where room_id = old.id;
  return null;
end;
$$;
revoke execute on function public.delete_room_custom_packs() from public, anon, authenticated;

create trigger rooms_delete_custom_packs
  after delete on public.rooms
  for each row
  execute function public.delete_room_custom_packs();
