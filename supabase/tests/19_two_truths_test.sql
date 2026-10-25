-- Two Truths and a Spill (migration 2300).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.rooms (id, code, pack_id, created_by, mode)
values ('00000000-0000-4000-8000-0000000000c6', 'TWOA', 'classic', gen_random_uuid(), 'two_truths');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c6', gen_random_uuid(), 'Ama', 1, 1),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000c6', gen_random_uuid(), 'Kofi', 2, 2);

-- A new card replaces the old card.
select public.save_mode_inputs('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c6', 1, 'pick',
  (select jsonb_agg(jsonb_build_object('question_id', id, 'value', 1)) from (select id from public.questions where pack_id = 'classic' order by id limit 3) q));
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c6', 1, 'pick',
    (select jsonb_agg(jsonb_build_object('question_id', id, 'value', 0)) from (select id from public.questions where pack_id = 'classic' order by id desc limit 3) q)),
  3, 'a new card replaces the old one'
);

-- A changed spot on the same card replaces the old spot.
select public.save_mode_inputs('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000c6', 1, 'spot',
  (select jsonb_agg(jsonb_build_object('question_id', id, 'target_id', '00000000-0000-4000-8000-0000000000a1')) from (select id from public.questions where pack_id = 'classic' order by id desc limit 1) q));
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000c6', 1, 'spot',
    (select jsonb_agg(jsonb_build_object('question_id', id, 'target_id', '00000000-0000-4000-8000-0000000000a1')) from (select id from public.questions where pack_id = 'classic' order by id desc offset 1 limit 1) q)),
  1, 'one spot per card'
);
select throws_ok(
  $$ insert into public.mode_inputs (room_id, round, player_id, kind) values
     ('00000000-0000-4000-8000-0000000000c6', 1, '00000000-0000-4000-8000-0000000000a1', 'guess') $$,
  '23514', null, 'only known kinds'
);

select * from finish();
rollback;
