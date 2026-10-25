-- Live reactions (migration 2700).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_function('public', 'send_reaction', array['uuid', 'uuid', 'text'], 'reactions can be broadcast');
select ok(
  not has_function_privilege('authenticated', 'public.send_reaction(uuid, uuid, text)', 'execute'),
  'players go through the API'
);
select throws_ok(
  $$ select public.send_reaction(gen_random_uuid(), gen_random_uuid(), 'hello') $$,
  '22023', 'unknown reaction', 'only the fixed emoji'
);

select * from finish();
rollback;
