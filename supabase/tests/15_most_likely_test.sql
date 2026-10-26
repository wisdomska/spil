-- Most Likely To (migration 1900).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select lives_ok(
  $$ update public.packs set format = 'prompts' where id = 'most_likely' $$,
  'packs may hold prompts'
);
select throws_ok(
  $$ update public.packs set format = 'essays' where id = 'classic' $$,
  '23514', null, 'still only known formats'
);
select is(
  (select format from public.packs where id = 'most_likely'), 'prompts',
  'the Most Likely To pack plays prompts'
);
select is(
  (select min_age::int from public.packs where id = 'most_likely'), 13,
  'Most Likely To is a 13+ pack'
);
select ok(
  (select count(*) from public.questions where pack_id = 'most_likely' and status = 'live') >= 30,
  'Most Likely To ships with 30 or more prompts'
);

-- A second vote on the same prompt replaces the first, whoever it was for.
insert into public.rooms (id, code, pack_id, created_by, mode)
values ('00000000-0000-4000-8000-0000000000c3', 'LKKA', 'most_likely', gen_random_uuid(), 'most_likely');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed) values
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000c3', gen_random_uuid(), 'Ama', 1, 1),
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000c3', gen_random_uuid(), 'Kofi', 2, 2),
  ('00000000-0000-4000-8000-0000000000d5', '00000000-0000-4000-8000-0000000000c3', gen_random_uuid(), 'Esi', 3, 3);
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000c3', 1, 'vote',
    (select jsonb_agg(jsonb_build_object('question_id', id, 'target_id', '00000000-0000-4000-8000-0000000000d4'))
     from (select id from public.questions where pack_id = 'most_likely' order by id limit 1) q)),
  1, 'one vote saved'
);
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000c3', 1, 'vote',
    (select jsonb_agg(jsonb_build_object('question_id', id, 'target_id', '00000000-0000-4000-8000-0000000000d5'))
     from (select id from public.questions where pack_id = 'most_likely' order by id limit 1) q)),
  1, 'a changed vote replaces the old one'
);
select is(
  (select answered_count from public.players where id = '00000000-0000-4000-8000-0000000000d3'), 1,
  'votes count as answered'
);

select * from finish();
rollback;
