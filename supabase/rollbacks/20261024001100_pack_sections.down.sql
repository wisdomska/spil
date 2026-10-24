-- Reverses 20261024001100_pack_sections.sql. Section, spice and preview marks are lost; packs and
-- questions stay. A setting that was moved from 12 to 10 stays at 10. Afterwards run
--   supabase migration repair --status reverted 20261024001100
alter table public.settings alter column questions_per_game set default 12;
alter table public.questions drop column if exists is_sample;
alter table public.packs drop column if exists spice, drop column if exists section;
