-- Editions (migration 20261125000100): a room plays the questions for everyone plus its own
-- local ones, never another place's.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_column('public', 'questions', 'region', 'a question can belong to a place');
select col_default_is('public', 'rooms', 'edition', 'global', 'rooms play the global edition by default');
select throws_ok(
  $$ insert into public.rooms (code, pack_id, created_by, edition) values ('EDXX', 'classic', gen_random_uuid(), 'US') $$,
  '23514', null, 'only known editions'
);

insert into public.packs (id, name, blurb, icon, tone, is_adult, heat, status, min_age)
values ('edition_test', 'Edition test', 'Test.', 'cards', 'raised', false, null, 'live', 13);
insert into public.questions (pack_id, text, region) values
  ('edition_test', 'question for everyone', null),
  ('edition_test', 'question for Ghana only', 'GH'),
  ('edition_test', 'question for Nigeria only', 'NG'),
  ('edition_test', 'question for West Africa', 'WA');

insert into public.rooms (id, code, pack_id, created_by, edition) values
  ('00000000-0000-4000-8000-0000000000e1', 'EDGL', 'edition_test', gen_random_uuid(), 'global'),
  ('00000000-0000-4000-8000-0000000000e2', 'EDGH', 'edition_test', gen_random_uuid(), 'GH'),
  ('00000000-0000-4000-8000-0000000000e3', 'EDNG', 'edition_test', gen_random_uuid(), 'NG');
select public.start_round('00000000-0000-4000-8000-0000000000e1', 'edition_test', 10);
select public.start_round('00000000-0000-4000-8000-0000000000e2', 'edition_test', 10);
select public.start_round('00000000-0000-4000-8000-0000000000e3', 'edition_test', 10);

create temp table drawn as
select rq.room_id, q.text
from public.room_questions rq join public.questions q on q.id = rq.question_id
where rq.room_id in ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2',
                     '00000000-0000-4000-8000-0000000000e3');

select set_eq(
  $$ select text from drawn where room_id = '00000000-0000-4000-8000-0000000000e1' $$,
  $$ values ('question for everyone') $$,
  'global plays only the questions for everyone'
);
select set_eq(
  $$ select text from drawn where room_id = '00000000-0000-4000-8000-0000000000e2' $$,
  $$ values ('question for Ghana only'), ('question for West Africa'), ('question for everyone') $$,
  'Ghana adds Ghana and West Africa questions'
);
select set_eq(
  $$ select text from drawn where room_id = '00000000-0000-4000-8000-0000000000e3' $$,
  $$ values ('question for Nigeria only'), ('question for West Africa'), ('question for everyone') $$,
  'Naija adds Nigeria and West Africa questions'
);

-- A pack whose questions are all local still plays in the global edition.
update public.questions set region = 'GH' where pack_id = 'edition_test' and region is null;
insert into public.rooms (id, code, pack_id, created_by) values
  ('00000000-0000-4000-8000-0000000000e4', 'EDAL', 'edition_test', gen_random_uuid());
select lives_ok(
  $$ select public.start_round('00000000-0000-4000-8000-0000000000e4', 'edition_test', 10) $$,
  'an all-local pack still starts in the global edition'
);
select is(
  (select count(*)::int from public.room_questions where room_id = '00000000-0000-4000-8000-0000000000e4'),
  4,
  'and plays every question'
);

select * from finish();
rollback;
