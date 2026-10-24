-- SPIL-11: server-driven reveal (migration 1400).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column('public', 'rooms', 'reveal_index', 'rooms track the reveal slide');
select has_column('public', 'rooms', 'reveal_at', 'rooms track when the slide began');
select has_trigger('public', 'rooms', 'rooms_broadcast_reveal', 'slide changes are broadcast');
select throws_ok(
  $$ insert into public.rooms (code, pack_id, created_by, reveal_index) values ('RVLA', 'classic', gen_random_uuid(), -1) $$,
  '23514', null, 'the slide index is never negative'
);
select ok(
  not has_column_privilege('authenticated', 'public.rooms', 'reveal_index', 'update'),
  'players cannot move the reveal on'
);

select * from finish();
rollback;
