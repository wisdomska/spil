-- Solo play: the minimum can be 1 (migration 1500).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select col_default_is('public', 'settings', 'min_players', '1', 'rooms can start with 1 player by default');
select lives_ok($$ update public.settings set min_players = 1 $$, 'a minimum of 1 is allowed');
select throws_ok($$ update public.settings set min_players = 0 $$, '23514', null, 'never fewer than 1');

select * from finish();
rollback;
