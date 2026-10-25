-- Spill or Skip (migration 2500).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_function('public', 'notify_room', array['uuid', 'text'], 'the API can refresh every phone in a room');
select ok(
  not has_function_privilege('authenticated', 'public.notify_room(uuid, text)', 'execute'),
  'players cannot call notify_room'
);
select ok(
  not has_function_privilege('anon', 'public.notify_room(uuid, text)', 'execute'),
  'anon cannot call notify_room'
);

select * from finish();
rollback;
