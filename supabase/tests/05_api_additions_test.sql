-- rooms.question_count and record_join (migrations 0600 and 0700).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_column('public', 'rooms', 'question_count', 'rooms has a host-chosen question count');
select col_is_null('public', 'rooms', 'question_count', 'question_count is optional');

select throws_ok(
  $$ insert into public.rooms (code, pack_id, created_by, question_count)
     values ('QQQQ', 'classic', gen_random_uuid(), 0) $$,
  '23514',
  null,
  'question_count must be at least 1'
);

select lives_ok(
  $$ insert into public.rooms (code, pack_id, created_by, question_count)
     values ('QQQR', 'classic', gen_random_uuid(), 20) $$,
  'question_count accepts a value in range'
);

-- record_join counts today's joins.
delete from public.stats_daily where day = (now() at time zone 'utc')::date;
select public.record_join();
select public.record_join();
select is(
  (select joins from public.stats_daily where day = (now() at time zone 'utc')::date),
  2,
  'record_join counts each join for today'
);

select ok(
  not has_function_privilege('anon', 'public.record_join()', 'execute'),
  'anon cannot call record_join'
);
select ok(
  not has_function_privilege('authenticated', 'public.record_join()', 'execute'),
  'players cannot call record_join'
);

select * from finish();
rollback;
