-- Achievements and cosmetics (migration 3400).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_table('public', 'player_stats', 'stats are kept per device session');
select ok((select relrowsecurity from pg_class where oid = 'public.player_stats'::regclass), 'player_stats has row level security');
select policies_are('public', 'player_stats', array['player_stats_select_own'], 'players read only their own stats');
select ok(not has_function_privilege('authenticated', 'public.record_round_stats(jsonb)', 'execute'), 'players cannot add stats');

select public.record_round_stats('[{"user_id":"00000000-0000-4000-8000-00000000ee01","games":1,"wins":1,"bullseyes":2,"hosted":1,"points":20,"mode":"classic"}]'::jsonb);
select public.record_round_stats('[{"user_id":"00000000-0000-4000-8000-00000000ee01","games":1,"wins":0,"bullseyes":0,"hosted":0,"points":5,"mode":"hot_takes"}]'::jsonb);
select is(
  (select games || ',' || wins || ',' || bullseyes || ',' || points from public.player_stats where user_id = '00000000-0000-4000-8000-00000000ee01'),
  '2,1,2,25', 'rounds add up'
);
select is(
  (select array_length(modes, 1) from public.player_stats where user_id = '00000000-0000-4000-8000-00000000ee01'),
  2, 'distinct modes are kept'
);
select throws_ok(
  $$ update public.player_stats set frame = 'rainbow' where user_id = '00000000-0000-4000-8000-00000000ee01' $$,
  '23514', null, 'only known frames'
);

select * from finish();
rollback;
