-- Structure: every public table has RLS, functions are locked down.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select tables_are(
  'public',
  array[
    'packs', 'questions', 'settings', 'feature_flags',
    'rooms', 'room_questions', 'players', 'answers', 'guesses', 'results', 'awards',
    'reports', 'messages', 'admins', 'audit_log', 'rate_limits', 'stats_daily', 'pack_plays',
    'captcha_events', 'mode_inputs', 'imposters'
  ],
  'public schema has exactly the spec tables'
);

select is(
  (
    select array_agg(c.relname::text order by c.relname)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ),
  null::text[],
  'every public table has RLS enabled'
);

select ok(
  (
    select 'security_invoker=true' = any (c.reloptions)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'players_public'
  ),
  'players_public is a security_invoker view'
);

-- Every function in public pins an empty search_path.
select is(
  (
    select array_agg(p.proname::text order by p.proname)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not ('search_path=""' = any (coalesce(p.proconfig, '{}')))
  ),
  null::text[],
  'every public function sets search_path to empty'
);

-- Helpers and game functions are security definer (trigger helpers that must
-- see the caller run as invoker; band_floor is a pure mapping that reads no table).
select is(
  (
    select array_agg(p.proname::text order by p.proname)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not p.prosecdef
      and p.proname not in ('set_updated_at', 'guard_question_update', 'band_floor')
  ),
  null::text[],
  'helper and game functions are security definer'
);

-- Service-role only functions.
select ok(not has_function_privilege('anon', 'public.advance_room(uuid, public.room_status, public.room_status)', 'execute'), 'anon cannot execute advance_room');
select ok(not has_function_privilege('authenticated', 'public.advance_room(uuid, public.room_status, public.room_status)', 'execute'), 'authenticated cannot execute advance_room');
select ok(has_function_privilege('service_role', 'public.advance_room(uuid, public.room_status, public.room_status)', 'execute'), 'service_role can execute advance_room');

select ok(not has_function_privilege('anon', 'public.save_results(uuid, int, jsonb, jsonb)', 'execute'), 'anon cannot execute save_results');
select ok(not has_function_privilege('authenticated', 'public.save_results(uuid, int, jsonb, jsonb)', 'execute'), 'authenticated cannot execute save_results');
select ok(has_function_privilege('service_role', 'public.save_results(uuid, int, jsonb, jsonb)', 'execute'), 'service_role can execute save_results');

select ok(not has_function_privilege('anon', 'public.start_round(uuid, text, int)', 'execute'), 'anon cannot execute start_round');
select ok(not has_function_privilege('authenticated', 'public.start_round(uuid, text, int)', 'execute'), 'authenticated cannot execute start_round');
select ok(has_function_privilege('service_role', 'public.start_round(uuid, text, int)', 'execute'), 'service_role can execute start_round');

select ok(not has_function_privilege('anon', 'public.expire_rooms()', 'execute'), 'anon cannot execute expire_rooms');
select ok(not has_function_privilege('authenticated', 'public.expire_rooms()', 'execute'), 'authenticated cannot execute expire_rooms');
select ok(has_function_privilege('service_role', 'public.expire_rooms()', 'execute'), 'service_role can execute expire_rooms');

select ok(not has_function_privilege('anon', 'public.check_rate_limit(text, int, interval)', 'execute'), 'anon cannot execute check_rate_limit');
select ok(not has_function_privilege('authenticated', 'public.check_rate_limit(text, int, interval)', 'execute'), 'authenticated cannot execute check_rate_limit');
select ok(has_function_privilege('service_role', 'public.check_rate_limit(text, int, interval)', 'execute'), 'service_role can execute check_rate_limit');

select ok(not has_function_privilege('anon', 'public.nudge(uuid, uuid)', 'execute'), 'anon cannot execute nudge');
select ok(not has_function_privilege('authenticated', 'public.nudge(uuid, uuid)', 'execute'), 'authenticated cannot execute nudge');
select ok(has_function_privilege('service_role', 'public.nudge(uuid, uuid)', 'execute'), 'service_role can execute nudge');

-- RLS helpers are callable from policies.
select ok(has_function_privilege('authenticated', 'public.is_room_member(uuid)', 'execute'), 'authenticated can execute is_room_member');
select ok(has_function_privilege('anon', 'public.is_admin(public.admin_role[])', 'execute'), 'anon can execute is_admin');

-- No client role may write game tables.
select ok(not has_table_privilege('authenticated', 'public.rooms', 'insert'), 'authenticated cannot insert rooms');
select ok(not has_table_privilege('authenticated', 'public.players', 'update'), 'authenticated cannot update players');
select ok(not has_table_privilege('authenticated', 'public.answers', 'insert'), 'authenticated cannot insert answers');
select ok(not has_table_privilege('anon', 'public.rate_limits', 'select'), 'anon cannot read rate_limits');
select ok(not has_column_privilege('authenticated', 'public.players', 'user_id', 'select'), 'authenticated cannot read players.user_id');

-- Realtime channel authorization policies exist.
select ok(
  exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'realtime' and tablename = 'messages'
      and policyname = 'room_members_receive_broadcasts' and cmd = 'SELECT'
  ),
  'realtime.messages has the room member select policy'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'realtime' and tablename = 'messages'
      and policyname = 'room_members_track_presence' and cmd = 'INSERT'
  ),
  'realtime.messages has the presence insert policy'
);

-- Seed sanity.
select is((select count(*)::int from public.settings), 1, 'settings is a singleton');
select is(
  (select array_agg(id order by id) from public.packs where status = 'live'),
  array['afterdark', 'campus', 'classic', 'groupchat', 'hot_takes', 'imposter', 'kink', 'most_likely', 'nolimits', 'red_green', 'roadtrip', 'sheets', 'work'],
  'thirteen live packs (nine seed, four from the Batch 1 mode migrations 1800 to 2200)'
);
select is((select status::text from public.packs where id = 'purity'), 'draft', 'purity pack is draft');
select is(
  (
    select count(*)::int from public.packs pk
    where pk.status = 'live'
      and (select count(*) from public.questions q where q.pack_id = pk.id and q.status = 'live') < 30
  ),
  0,
  'every live pack has at least 30 live questions'
);
select is(
  (select count(*)::int from public.packs where is_adult and heat is null),
  0,
  'every adult pack has a heat level'
);
select is(
  (select enabled from public.feature_flags where key = 'test_players'),
  true,
  'test players are on locally'
);

select * from finish();
rollback;
