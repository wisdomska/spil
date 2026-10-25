-- Imposter (migration 2200).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_column('public', 'questions', 'alt_text', 'questions can carry the imposter''s alternative');
select has_table('public', 'imposters', 'who the imposter is has its own table');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.imposters'::regclass),
  'imposters has row level security'
);
select policies_are(
  'public', 'imposters', array['imposters_select_revealed'],
  'members read the imposter only after the reveal'
);
select ok(not has_table_privilege('anon', 'public.imposters', 'select'), 'anon cannot read imposters');
select ok(not has_table_privilege('authenticated', 'public.imposters', 'insert'), 'players cannot pick the imposter');
select is(
  (select format from public.packs where id = 'imposter'), 'pairs',
  'the Imposter pack plays pairs'
);
select ok(
  (select count(*) from public.questions
   where pack_id = 'imposter' and status = 'live' and alt_text is not null) >= 30,
  'Imposter ships with 30 or more pairs, each with an alternative'
);

-- A changed imposter vote (no question) replaces the old one.
insert into public.rooms (id, code, pack_id, created_by, mode)
values ('00000000-0000-4000-8000-0000000000c5', 'IMPA', 'imposter', gen_random_uuid(), 'imposter');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000c5', gen_random_uuid(), 'Ama', 1, 1),
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000c5', gen_random_uuid(), 'Kofi', 2, 2),
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000c5', gen_random_uuid(), 'Esi', 3, 3);
select public.save_mode_inputs('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000c5', 1, 'vote',
  '[{"target_id": "00000000-0000-4000-8000-0000000000f2"}]'::jsonb);
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000c5', 1, 'vote',
    '[{"target_id": "00000000-0000-4000-8000-0000000000f3"}]'::jsonb),
  1, 'still one vote after changing it'
);
select is(
  (select target_id from public.mode_inputs
   where player_id = '00000000-0000-4000-8000-0000000000f1' and kind = 'vote'),
  '00000000-0000-4000-8000-0000000000f3'::uuid, 'the new vote is kept'
);

select * from finish();
rollback;
