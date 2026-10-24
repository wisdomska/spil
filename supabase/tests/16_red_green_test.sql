-- Red Flag, Green Flag (migration 2000).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select lives_ok(
  $$ update public.packs set format = 'flags' where id = 'red_green' $$,
  'packs may hold scenarios'
);
select throws_ok(
  $$ update public.packs set format = 'essays' where id = 'classic' $$,
  '23514', null, 'still only known formats'
);
select is(
  (select format from public.packs where id = 'red_green'), 'flags',
  'the Red Flag, Green Flag pack plays scenarios'
);
select is(
  (select min_age::int from public.packs where id = 'red_green'), 13,
  'Red Flag, Green Flag is a 13+ pack'
);
select ok(
  (select count(*) from public.questions where pack_id = 'red_green' and status = 'live') >= 30,
  'Red Flag, Green Flag ships with 30 or more scenarios'
);

select * from finish();
rollback;
