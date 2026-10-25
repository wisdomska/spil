-- Reverses 20261024003200_local_packs.sql. Afterwards run
--   supabase migration repair --status reverted 20261024003200
-- Rooms on these packs (rooms last 7 days) move back to Classic first.
update public.rooms set pack_id = 'classic'
  where pack_id in ('shs_days', 'exam_season', 'church_kid', 'detty_december');
delete from public.packs where id in ('shs_days', 'exam_season', 'church_kid', 'detty_december');
