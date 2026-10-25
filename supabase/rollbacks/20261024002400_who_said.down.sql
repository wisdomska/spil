-- Reverses 20261024002400_who_said.sql. Afterwards run
--   supabase migration repair --status reverted 20261024002400
-- Rooms that played Who Said That? point at the pack; they are deleted with it (rooms last 7
-- days). The report type value 'answer' stays (Postgres cannot drop an enum value); reports of
-- that type are deleted.

delete from public.reports where type = 'answer';
delete from public.rooms where pack_id = 'who_said';
delete from public.packs where id = 'who_said';
drop table if exists public.text_guesses;
alter table public.reports drop column if exists mode_input_id;
alter table public.mode_inputs drop column if exists hidden;
alter table public.packs drop constraint if exists packs_format_check;
alter table public.packs
  add constraint packs_format_check
  check (format in ('yes_no', 'statements', 'prompts', 'flags', 'pairs'));
