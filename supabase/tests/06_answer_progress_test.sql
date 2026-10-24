-- SPIL-03: players.answered_count, last_answer_at and save_answers (migration 0900).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_column('public', 'players', 'answered_count', 'players has an answered count');
select has_column('public', 'players', 'last_answer_at', 'players has a last answer time');

insert into public.rooms (id, code, pack_id, created_by, status)
values ('00000000-0000-4000-8000-0000000000a1', 'PRGA', 'classic', gen_random_uuid(), 'answering');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1',
        gen_random_uuid(), 'Kwame', 1, 7);

select is(
  public.save_answers(
    '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 1,
    (select jsonb_agg(jsonb_build_object('question_id', id, 'value', 'yes'))
     from (select id from public.questions where pack_id = 'classic' order by id limit 2) q)
  ),
  2,
  'save_answers returns the count for the round'
);

select is(
  (select answered_count from public.players where id = '00000000-0000-4000-8000-0000000000b1'),
  2,
  'the count lands on the player row'
);
select isnt(
  (select last_answer_at from public.players where id = '00000000-0000-4000-8000-0000000000b1'),
  null,
  'the last answer time is set'
);

-- A corrected answer does not double count.
select is(
  public.save_answers(
    '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 1,
    (select jsonb_agg(jsonb_build_object('question_id', id, 'value', 'no'))
     from (select id from public.questions where pack_id = 'classic' order by id limit 1) q)
  ),
  2,
  'a corrected answer keeps the count'
);

select ok(
  not has_function_privilege('anon', 'public.save_answers(uuid, uuid, int, jsonb)', 'execute'),
  'anon cannot call save_answers'
);
select ok(
  not has_function_privilege('authenticated', 'public.save_answers(uuid, uuid, int, jsonb)', 'execute'),
  'players cannot call save_answers'
);

select * from finish();
rollback;
