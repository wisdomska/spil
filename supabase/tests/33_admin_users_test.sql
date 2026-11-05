-- Admin Users (migration 20261105000100).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select ok(not has_function_privilege('authenticated', 'public.admin_accounts(text, text, int, int)', 'execute'), 'players cannot list accounts');
select ok(not has_function_privilege('anon', 'public.admin_accounts(text, text, int, int)', 'execute'), 'visitors cannot list accounts');
select ok(not has_function_privilege('authenticated', 'public.admin_user_summary()', 'execute'), 'players cannot read the summary');

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at, last_sign_in_at)
values
  ('00000000-0000-4000-8000-0000000b0001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b1@players.spil.invalid', false, now() - interval '30 days', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000b0002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b2@players.spil.invalid', false, now() - interval '2 days', now() - interval '20 days'),
  ('00000000-0000-4000-8000-0000000b0003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true, now(), null);
insert into public.profiles (user_id, username, recovery_hash, created_at)
values
  ('00000000-0000-4000-8000-0000000b0001', 'ama_old', repeat('h', 40), now() - interval '30 days'),
  ('00000000-0000-4000-8000-0000000b0002', 'kofi_new', repeat('h', 40), now() - interval '2 days');
select public.record_round_stats('[{"user_id":"00000000-0000-4000-8000-0000000b0001","games":4,"wins":2,"bullseyes":0,"hosted":1,"points":40,"mode":"classic"}]'::jsonb);

select is((public.admin_accounts('', 'all', 20, 0) ->> 'total')::int >= 2, true, 'every account is listed');
select is(
  (select e ->> 'username' from jsonb_array_elements(public.admin_accounts('', 'all', 20, 0) -> 'rows') e limit 1),
  'kofi_new', 'newest first'
);
select is((public.admin_accounts('AMA', 'all', 20, 0) ->> 'total')::int, 1, 'search ignores case');
select is((public.admin_accounts('a_o', 'all', 20, 0) ->> 'total')::int, 1, 'an underscore in the search is matched literally');
select is(
  (select (e ->> 'games')::int from jsonb_array_elements(public.admin_accounts('ama_old', 'all', 20, 0) -> 'rows') e),
  4, 'stats come along'
);
select is(
  (select count(*)::int from jsonb_array_elements(public.admin_accounts('', 'new', 20, 0) -> 'rows') e where e ->> 'username' in ('ama_old', 'kofi_new')),
  1, 'new this week shows only recent accounts'
);
select is(
  (select count(*)::int from jsonb_array_elements(public.admin_accounts('', 'active', 20, 0) -> 'rows') e where e ->> 'username' in ('ama_old', 'kofi_new')),
  1, 'active this week goes by last seen'
);
select ok(public.admin_accounts('', 'all', 20, 0)::text !~ 'players\.spil\.invalid', 'no email address is ever returned');

select * from finish();
rollback;
