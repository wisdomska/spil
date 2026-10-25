-- Nudge cooldown (migration 3600): one nudge per target per 20 seconds.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.rooms (id, code, pack_id, created_by) values
  ('b3600000-0000-0000-0000-000000000001', 'NDGE', 'classic', '11111111-1111-1111-1111-111111111111');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed, age_confirmed) values
  ('c3600000-0000-0000-0000-000000000001', 'b3600000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Kofi', 1, 1, true),
  ('c3600000-0000-0000-0000-000000000002', 'b3600000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Ama', 2, 2, true);

select has_column('public', 'players', 'nudged_at', 'players keep their last nudge');
select lives_ok(
  $$ select public.nudge('b3600000-0000-0000-0000-000000000001', 'c3600000-0000-0000-0000-000000000002') $$,
  'the first nudge goes through'
);
select throws_ok(
  $$ select public.nudge('b3600000-0000-0000-0000-000000000001', 'c3600000-0000-0000-0000-000000000002') $$,
  'P0001',
  'RATE_LIMITED',
  'a second nudge within 20 seconds is refused'
);
update public.players set nudged_at = now() - interval '21 seconds'
  where id = 'c3600000-0000-0000-0000-000000000002';
select lives_ok(
  $$ select public.nudge('b3600000-0000-0000-0000-000000000001', 'c3600000-0000-0000-0000-000000000002') $$,
  'after 20 seconds the next nudge goes through'
);

select * from finish();
rollback;
