-- Admin Users (migrations 20261105000100 and 20261109000100: guests who played are listed too).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select ok(not has_function_privilege('authenticated', 'public.admin_accounts(text, text, int, int)', 'execute'), 'players cannot list accounts');
select ok(not has_function_privilege('anon', 'public.admin_accounts(text, text, int, int)', 'execute'), 'visitors cannot list accounts');
select ok(not has_function_privilege('authenticated', 'public.admin_user_summary()', 'execute'), 'players cannot read the summary');

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at, last_sign_in_at)
values
  ('00000000-0000-4000-8000-0000000b0001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b1@players.spil.invalid', false, now() - interval '30 days', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000b0002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b2@players.spil.invalid', false, now() - interval '2 days', now() - interval '20 days'),
  ('00000000-0000-4000-8000-0000000b0003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now(), null),
  ('00000000-0000-4000-8000-0000000b0004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now() - interval '3 days', null);
-- Guest b0004 played two rooms, last as "Zed Zebra"; guest b0003 only visited.
insert into public.rooms (id, code, pack_id, created_by) values
  ('b0000000-0000-4000-8000-0000000b0a01', 'QQWW', 'classic', '00000000-0000-4000-8000-0000000b0004'),
  ('b0000000-0000-4000-8000-0000000b0a02', 'QQWX', 'classic', '00000000-0000-4000-8000-0000000b0004');
insert into public.players (room_id, user_id, nickname, avatar, rotation_seed, joined_at) values
  ('b0000000-0000-4000-8000-0000000b0a01', '00000000-0000-4000-8000-0000000b0004', 'Old Name', 1, 1, now() - interval '2 days'),
  ('b0000000-0000-4000-8000-0000000b0a02', '00000000-0000-4000-8000-0000000b0004', 'Zed Zebra', 1, 1, now() - interval '1 hour');
insert into public.profiles (user_id, username, recovery_hash, created_at)
values
  ('00000000-0000-4000-8000-0000000b0001', 'ama_old', repeat('h', 40), now() - interval '30 days'),
  ('00000000-0000-4000-8000-0000000b0002', 'kofi_new', repeat('h', 40), now() - interval '2 days');
select public.record_round_stats('[{"user_id":"00000000-0000-4000-8000-0000000b0001","games":4,"wins":2,"bullseyes":0,"hosted":1,"points":40,"mode":"classic"}]'::jsonb);

select is((public.admin_accounts('', 'all', 20, 0) ->> 'total')::int >= 2, true, 'every account is listed');
-- Assertions name these players only, so other data in the database cannot change the result.
select ok(
  (select min(o) filter (where e ->> 'username' = 'kofi_new') < min(o) filter (where e ->> 'username' = 'ama_old')
   from jsonb_array_elements(public.admin_accounts('', 'accounts', 1000, 0) -> 'rows') with ordinality as x(e, o)),
  'newest first'
);
select is((public.admin_accounts('AMA_OL', 'all', 20, 0) ->> 'total')::int, 1, 'search ignores case');
select is((public.admin_accounts('a_o', 'all', 20, 0) ->> 'total')::int, 1, 'an underscore in the search is matched literally');
select is(
  (select (e ->> 'games')::int from jsonb_array_elements(public.admin_accounts('ama_old', 'all', 20, 0) -> 'rows') e),
  4, 'stats come along'
);
select is(
  (select count(*)::int from jsonb_array_elements(public.admin_accounts('', 'new', 1000, 0) -> 'rows') e where e ->> 'username' in ('ama_old', 'kofi_new')),
  1, 'new this week shows only recent accounts'
);
select is(
  (select count(*)::int from jsonb_array_elements(public.admin_accounts('', 'active', 1000, 0) -> 'rows') e where e ->> 'username' in ('ama_old', 'kofi_new')),
  1, 'active this week goes by last seen'
);
select ok(public.admin_accounts('', 'all', 20, 0)::text !~ 'players\.spil\.invalid', 'no email address is ever returned');

select is(
  (select e ->> 'kind' from jsonb_array_elements(public.admin_accounts('zed', 'all', 20, 0) -> 'rows') e),
  'guest', 'a guest who played is listed and found by name'
);
select is(
  (select e ->> 'username' from jsonb_array_elements(public.admin_accounts('', 'guests', 1000, 0) -> 'rows') e
   where e ->> 'userId' = '00000000-0000-4000-8000-0000000b0004'),
  'Zed Zebra', 'a guest shows the name they last played under'
);
select is(
  (select count(*)::int from jsonb_array_elements(public.admin_accounts('', 'all', 1000, 0) -> 'rows') e
   where e ->> 'userId' = '00000000-0000-4000-8000-0000000b0003'),
  0, 'a guest who never played is not listed'
);
select is(
  (select count(*)::int from jsonb_array_elements(public.admin_accounts('', 'guests', 1000, 0) -> 'rows') e where e ->> 'kind' <> 'guest'),
  0, 'the guests filter shows guests only'
);
select is(
  (select count(*)::int from jsonb_array_elements(public.admin_accounts('', 'accounts', 1000, 0) -> 'rows') e where e ->> 'kind' <> 'account'),
  0, 'the accounts filter shows accounts only'
);
select ok((public.admin_user_summary() ->> 'guests')::int >= 1, 'the summary counts guests who played');
select ok(
  (public.admin_user_summary() ->> 'visitors')::int > (public.admin_user_summary() ->> 'guests')::int,
  'visitors include guests who never played'
);

select * from finish();
rollback;
