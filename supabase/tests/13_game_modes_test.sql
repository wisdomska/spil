-- Game modes (migration 1600).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_column('public', 'rooms', 'mode', 'rooms have a mode');
select col_default_is('public', 'rooms', 'mode', 'classic', 'rooms play classic by default');
select throws_ok(
  $$ insert into public.rooms (code, pack_id, created_by, mode) values ('MDAA', 'classic', gen_random_uuid(), 'poker') $$,
  '23514', null, 'only known modes'
);
select has_table('public', 'mode_inputs', 'mode inputs are stored');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.mode_inputs'::regclass),
  'mode_inputs has row level security'
);
select ok(not has_table_privilege('anon', 'public.mode_inputs', 'select'), 'anon cannot read inputs');
select ok(not has_table_privilege('authenticated', 'public.mode_inputs', 'insert'), 'players cannot write inputs');
select policies_are(
  'public', 'mode_inputs',
  array['mode_inputs_select_own', 'mode_inputs_select_revealed'],
  'players read their own inputs, and everyone after the reveal'
);

-- save_mode_inputs replaces a slot instead of adding a second row.
insert into public.rooms (id, code, pack_id, created_by, mode)
values ('00000000-0000-4000-8000-0000000000c1', 'MDBB', 'classic', gen_random_uuid(), 'room_percentage');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed)
values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), 'Ama', 1, 1);
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', 1, 'percent',
    (select jsonb_agg(jsonb_build_object('question_id', id, 'value', 40)) from (select id from public.questions where pack_id = 'classic' order by id limit 2) q)),
  2, 'two percent guesses saved'
);
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000c1', 1, 'percent',
    (select jsonb_agg(jsonb_build_object('question_id', id, 'value', 70)) from (select id from public.questions where pack_id = 'classic' order by id limit 1) q)),
  2, 'a changed guess replaces the old one'
);
select ok(
  not has_function_privilege('authenticated', 'public.save_mode_inputs(uuid, uuid, int, text, jsonb)', 'execute'),
  'players cannot call save_mode_inputs'
);

select * from finish();
rollback;
