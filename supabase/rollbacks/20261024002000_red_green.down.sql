-- Reverses 20261024002000_red_green.sql. Afterwards run
--   supabase migration repair --status reverted 20261024002000
-- Rooms that played Red Flag, Green Flag point at the pack; they are deleted with it (rooms last
-- 7 days).

delete from public.rooms where pack_id = 'red_green';
delete from public.packs where id = 'red_green';
alter table public.packs drop constraint if exists packs_format_check;
alter table public.packs
  add constraint packs_format_check check (format in ('yes_no', 'statements', 'prompts'));
