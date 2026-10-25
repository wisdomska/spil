-- Teen, seasonal and local packs (migration 3200).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  (select array_agg(id order by id) from public.packs where id in ('shs_days', 'exam_season', 'church_kid', 'detty_december') and status = 'live'),
  array['church_kid', 'detty_december', 'exam_season', 'shs_days'],
  'the four new packs are live'
);
select is(
  (select min_age::int from public.packs where id = 'detty_december'), 16,
  'Detty December is 16+'
);
select ok(
  (select bool_and(min_age = 13 and not is_adult) from public.packs where id in ('shs_days', 'exam_season', 'church_kid')),
  'SHS Days, Exam Season and Church Kid are 13+'
);
select is(
  (select region from public.packs where id = 'shs_days'), 'GH',
  'SHS Days is a Ghana pack'
);

select * from finish();
rollback;
