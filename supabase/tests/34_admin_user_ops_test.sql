-- Admin user operations (migration 20261113000100): bans, one person's detail, sorting, sign-out.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Players and visitors can reach none of it.
select ok(not has_function_privilege('authenticated', 'public.admin_user_detail(uuid)', 'execute'), 'players cannot read a person');
select ok(not has_function_privilege('anon', 'public.admin_user_detail(uuid)', 'execute'), 'visitors cannot read a person');
select ok(not has_function_privilege('authenticated', 'public.admin_revoke_sessions(uuid)', 'execute'), 'players cannot sign others out');
select ok(not has_function_privilege('anon', 'public.admin_revoke_sessions(uuid)', 'execute'), 'visitors cannot sign others out');
select ok(not has_table_privilege('authenticated', 'public.user_bans', 'select'), 'players cannot read bans');
select ok(not has_table_privilege('anon', 'public.user_bans', 'insert'), 'visitors cannot write bans');
select is((select relrowsecurity from pg_class where oid = 'public.user_bans'::regclass), true, 'bans have RLS on');

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at, last_sign_in_at)
values
  ('00000000-0000-4000-8000-0000000c0001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@players.spil.invalid', false, now() - interval '9 days', now()),
  ('00000000-0000-4000-8000-0000000c0002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now() - interval '1 day', null);
insert into public.profiles (user_id, username, recovery_hash, created_at)
values ('00000000-0000-4000-8000-0000000c0001', 'zz_alpha', repeat('h', 40), now() - interval '9 days');
insert into public.rooms (id, code, pack_id, created_by) values
  ('c0000000-0000-4000-8000-0000000c0a01', 'ZZQW', 'classic', '00000000-0000-4000-8000-0000000c0002');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed, joined_at) values
  ('c0000000-0000-4000-8000-0000000c0b01', 'c0000000-0000-4000-8000-0000000c0a01', '00000000-0000-4000-8000-0000000c0002', 'Zz Guest', 1, 1, now()),
  ('c0000000-0000-4000-8000-0000000c0b02', 'c0000000-0000-4000-8000-0000000c0a01', '00000000-0000-4000-8000-0000000c0001', 'Zz Alpha', 2, 1, now());
insert into public.reports (type, reason, reporter_user_id, room_id, player_id)
values ('nickname', 'rude', '00000000-0000-4000-8000-0000000c0001', 'c0000000-0000-4000-8000-0000000c0a01', 'c0000000-0000-4000-8000-0000000c0b01');
select public.record_round_stats('[{"user_id":"00000000-0000-4000-8000-0000000c0001","games":9,"wins":1,"bullseyes":0,"hosted":0,"points":5,"mode":"classic"}]'::jsonb);

-- Detail.
select is(public.admin_user_detail('00000000-0000-4000-8000-0000000c0002') ->> 'kind', 'guest', 'a guest reads as a guest');
select is(public.admin_user_detail('00000000-0000-4000-8000-0000000c0002') ->> 'username', 'Zz Guest', 'a guest goes by their last nickname');
select is((public.admin_user_detail('00000000-0000-4000-8000-0000000c0002') ->> 'reportsAgainstTotal')::int, 1, 'reports against them are counted');
select is((public.admin_user_detail('00000000-0000-4000-8000-0000000c0001') ->> 'reportsBy')::int, 1, 'reports they made are counted');
select is((public.admin_user_detail('00000000-0000-4000-8000-0000000c0002') ->> 'liveRooms')::int, 1, 'live rooms are counted');
select is(jsonb_array_length(public.admin_user_detail('00000000-0000-4000-8000-0000000c0002') -> 'rooms'), 1, 'their rooms are listed');
select ok(public.admin_user_detail('00000000-0000-4000-8000-0000000c0001')::text !~ 'players\.spil\.invalid', 'no email address in the detail');
select is(public.admin_user_detail('00000000-0000-4000-8000-0000000c9999'), null, 'an unknown person is null');

-- Bans show in the list and the Banned filter, and lapse when they expire.
insert into public.user_bans (user_id, reason, expires_at) values
  ('00000000-0000-4000-8000-0000000c0002', 'spam', null),
  ('00000000-0000-4000-8000-0000000c0001', 'old', now() - interval '1 minute');
select is(
  (select (e ->> 'banned')::boolean from jsonb_array_elements(public.admin_accounts('Zz Guest', 'all', 20, 0) -> 'rows') e),
  true, 'a banned person is flagged in the list'
);
select is(
  (select count(*)::int from jsonb_array_elements(public.admin_accounts('', 'banned', 1000, 0) -> 'rows') e
   where e ->> 'userId' in ('00000000-0000-4000-8000-0000000c0001', '00000000-0000-4000-8000-0000000c0002')),
  1, 'the Banned filter skips expired bans'
);
select is(public.admin_user_detail('00000000-0000-4000-8000-0000000c0002') -> 'ban' ->> 'reason', 'spam', 'the detail shows the ban');

-- Sorting.
select ok(
  (select min(o) filter (where e ->> 'username' = 'zz_alpha') < min(o) filter (where e ->> 'username' = 'Zz Guest')
   from jsonb_array_elements(public.admin_accounts('zz', 'all', 1000, 0, 'games_desc') -> 'rows') with ordinality as x(e, o)),
  'most games first'
);

-- Signing out removes every session.
insert into auth.sessions (id, user_id, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-0000000c0001', now(), now());
select is(public.admin_revoke_sessions('00000000-0000-4000-8000-0000000c0001'), 1, 'sign-out removes their session');

select * from finish();
rollback;
