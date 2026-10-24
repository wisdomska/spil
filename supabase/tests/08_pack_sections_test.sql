-- SPIL-08: pack sections, spice and preview questions (migration 1100).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_column('public', 'packs', 'section', 'packs have a section');
select has_column('public', 'packs', 'spice', 'packs have a spice level');
select has_column('public', 'questions', 'is_sample', 'questions can be marked for the preview');
select col_default_is('public', 'questions', 'is_sample', 'false', 'questions are not samples by default');

select throws_ok(
  $$ update public.packs set section = 'party' where id = 'classic' $$,
  '23514', null, 'section is everyday, life or after_dark'
);
select throws_ok(
  $$ update public.packs set spice = 6 where id = 'classic' $$,
  '23514', null, 'spice is 1 to 5'
);
select is(
  (select count(*)::int from public.packs where min_age >= 18 and section <> 'after_dark'),
  0,
  'every 18+ pack sits in After dark'
);
select col_default_is('public', 'settings', 'questions_per_game', '10', 'hosts get 10 questions by default');

select * from finish();
rollback;
