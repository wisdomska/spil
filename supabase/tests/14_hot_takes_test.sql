-- Hot Takes (migration 1800).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_column('public', 'packs', 'format', 'packs have a format');
select col_default_is('public', 'packs', 'format', 'yes_no', 'packs are yes or no by default');
select throws_ok(
  $$ update public.packs set format = 'essays' where id = 'classic' $$,
  '23514', null, 'only known formats'
);
select is(
  (select format from public.packs where id = 'hot_takes'), 'statements',
  'the Hot Takes pack plays statements'
);
select is(
  (select min_age::int from public.packs where id = 'hot_takes'), 13,
  'Hot Takes is a 13+ pack'
);
select ok(
  (select count(*) from public.questions where pack_id = 'hot_takes' and status = 'live') >= 30,
  'Hot Takes ships with 30 or more statements'
);

-- Ratings update the player's live count; other kinds do not.
insert into public.rooms (id, code, pack_id, created_by, mode)
values ('00000000-0000-4000-8000-0000000000c2', 'HOTA', 'hot_takes', gen_random_uuid(), 'hot_takes');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed)
values ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c2', gen_random_uuid(), 'Kofi', 2, 2);
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c2', 1, 'rating',
    (select jsonb_agg(jsonb_build_object('question_id', id, 'value', 65)) from (select id from public.questions where pack_id = 'hot_takes' order by id limit 3) q)),
  3, 'three ratings saved'
);
select is(
  (select answered_count from public.players where id = '00000000-0000-4000-8000-0000000000d2'), 3,
  'ratings count as answered'
);
select lives_ok(
  $$ select public.save_mode_inputs('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000c2', 1, 'percent',
       (select jsonb_agg(jsonb_build_object('question_id', id, 'value', 50)) from (select id from public.questions where pack_id = 'hot_takes' order by id limit 1) q)) $$,
  'guesses of the average still save'
);

select * from finish();
rollback;
