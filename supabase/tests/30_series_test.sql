-- Series score (migration 3500).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select has_column('public', 'rooms', 'series_start', 'rooms keep where their series starts');
select col_default_is('public', 'rooms', 'series_start', '1', 'a series starts at round 1');
select col_has_check('public', 'rooms', 'series_start', 'series_start is checked to be at least 1');
select * from finish();
rollback;
