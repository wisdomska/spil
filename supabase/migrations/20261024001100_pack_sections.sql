-- SPIL-08: pack picker sections, a spice level per pack and preview questions.
-- Rollback: supabase/rollbacks/20261024001100_pack_sections.down.sql

alter table public.packs
  add column section text not null default 'everyday'
    check (section in ('everyday', 'life', 'after_dark')),
  add column spice smallint not null default 2 check (spice between 1 and 5);

-- Sections from the spec: Everyday (Classic, Group Chat), Life stages (Campus Life, 9 to 5,
-- Passport Stamps), After dark for every 18+ pack. Spice is a starting point the admin can edit.
update public.packs set section = 'life' where id in ('campus', 'work', 'roadtrip');
update public.packs set section = 'after_dark' where min_age >= 18;
update public.packs set spice = case id
  when 'classic' then 2
  when 'groupchat' then 2
  when 'campus' then 2
  when 'work' then 1
  when 'roadtrip' then 2
  when 'afterdark' then 3
  when 'sheets' then 4
  when 'kink' then 4
  when 'nolimits' then 5
  when 'purity' then 3
  else spice
end;

-- Up to three questions per pack marked for the pack preview.
alter table public.questions add column is_sample boolean not null default false;

-- Hosts get 10 questions by default (was 12). Only a setting still on the old default moves.
alter table public.settings alter column questions_per_game set default 10;
update public.settings set questions_per_game = 10 where questions_per_game = 12;
