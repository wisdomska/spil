-- Daily Spill (migration 2800).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_table('public', 'daily_answers', 'daily answers are stored');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.daily_answers'::regclass),
  'daily_answers has row level security'
);
select ok(not has_table_privilege('anon', 'public.daily_answers', 'select'), 'anon cannot read answers');
select ok(not has_table_privilege('authenticated', 'public.daily_answers', 'select'), 'players cannot read answers');
select throws_ok(
  $$ insert into public.daily_answers (day, user_id, question_id, value)
     values (current_date, gen_random_uuid(), (select id from public.questions limit 1), 'skip') $$,
  '23514', null, 'only yes or no'
);

select * from finish();
rollback;
