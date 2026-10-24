-- SPIL-09: per-guess points (migration 1300).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_column('public', 'guesses', 'points', 'guesses store their points');
select col_is_null('public', 'guesses', 'points', 'older rounds have no stored points');
select has_column('public', 'guesses', 'closest', 'guesses store the closest bonus');
select col_default_is('public', 'guesses', 'closest', 'false', 'not closest by default');

select * from finish();
rollback;
