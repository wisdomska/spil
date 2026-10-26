-- Optional accounts (migration 20261026000100).
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'profiles', 'accounts have a profile');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has row level security');
select policies_are('public', 'profiles', array['profiles_select_own'], 'players read only their own profile');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'players cannot create a profile directly');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'update'), 'players cannot change a profile directly');
select ok(not has_function_privilege('authenticated', 'public.merge_guest_progress(uuid, uuid)', 'execute'), 'players cannot merge progress directly');
select ok(not has_function_privilege('authenticated', 'public.delete_account_data(uuid)', 'execute'), 'players cannot delete data directly');

insert into auth.users (id, instance_id, aud, role, email, is_anonymous)
values
  ('00000000-0000-4000-8000-0000000a0001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a1@players.spil.invalid', false),
  ('00000000-0000-4000-8000-0000000a0002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true),
  ('00000000-0000-4000-8000-0000000a0003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, true);

insert into public.profiles (user_id, username, recovery_hash)
values ('00000000-0000-4000-8000-0000000a0001', 'Senya_7', repeat('h', 40));
select throws_ok(
  $$ insert into public.profiles (user_id, username, recovery_hash) values ('00000000-0000-4000-8000-0000000a0002', 'senya_7', repeat('h', 40)) $$,
  '23505', null, 'usernames are unique whatever their case'
);
select throws_ok(
  $$ insert into public.profiles (user_id, username, recovery_hash) values ('00000000-0000-4000-8000-0000000a0002', 'no spaces', repeat('h', 40)) $$,
  '23514', null, 'usernames are letters, numbers and underscores'
);

-- A player reads their own profile and nobody else's.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-8000-0000000a0002", "role": "authenticated"}';
select is((select count(*)::int from public.profiles), 0, 'another player cannot read the profile');
set local request.jwt.claims to '{"sub": "00000000-0000-4000-8000-0000000a0001", "role": "authenticated"}';
select is((select username from public.profiles), 'Senya_7', 'the owner reads their profile');
reset role;

-- Merge: a guest on a second phone adds their stats, crews and daily answers to the account.
select public.record_round_stats('[{"user_id":"00000000-0000-4000-8000-0000000a0001","games":3,"wins":1,"bullseyes":0,"hosted":1,"points":30,"mode":"classic"}]'::jsonb);
select public.record_round_stats('[{"user_id":"00000000-0000-4000-8000-0000000a0002","games":2,"wins":1,"bullseyes":1,"hosted":0,"points":15,"mode":"hot_takes"}]'::jsonb);
insert into public.crews (id, name, invite_token, created_by)
values ('00000000-0000-4000-8000-0000000c0001', 'Hostel', repeat('t', 20), '00000000-0000-4000-8000-0000000a0002');
insert into public.crew_members (crew_id, user_id, nickname, joined_at)
values
  ('00000000-0000-4000-8000-0000000c0001', '00000000-0000-4000-8000-0000000a0002', 'Senya', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000c0001', '00000000-0000-4000-8000-0000000a0003', 'Ama', now() - interval '1 day');
insert into public.daily_answers (day, user_id, question_id, value)
select current_date, '00000000-0000-4000-8000-0000000a0002', id, 'yes' from public.questions limit 1;

select public.merge_guest_progress('00000000-0000-4000-8000-0000000a0002', '00000000-0000-4000-8000-0000000a0001');
select is(
  (select games || ',' || wins || ',' || points || ',' || array_length(modes, 1) from public.player_stats where user_id = '00000000-0000-4000-8000-0000000a0001'),
  '5,2,45,2', 'stats add up and modes merge'
);
select is(
  (select count(*)::int from public.player_stats where user_id = '00000000-0000-4000-8000-0000000a0002'),
  0, 'the guest keeps nothing'
);
select is(
  (select created_by from public.crews where id = '00000000-0000-4000-8000-0000000c0001'),
  '00000000-0000-4000-8000-0000000a0001'::uuid, 'crews the guest started belong to the account'
);
select is(
  (select count(*)::int from public.daily_answers where user_id = '00000000-0000-4000-8000-0000000a0001'),
  1, 'daily answers move over'
);

-- Delete account: everything goes, and the crew passes to the next member.
select public.delete_account_data('00000000-0000-4000-8000-0000000a0001');
select is(
  (select (select count(*) from public.profiles where user_id = '00000000-0000-4000-8000-0000000a0001')
        + (select count(*) from public.player_stats where user_id = '00000000-0000-4000-8000-0000000a0001')
        + (select count(*) from public.daily_answers where user_id = '00000000-0000-4000-8000-0000000a0001')
        + (select count(*) from public.crew_members where user_id = '00000000-0000-4000-8000-0000000a0001'))::int,
  0, 'profile, stats, daily answers and memberships are gone'
);
select is(
  (select created_by from public.crews where id = '00000000-0000-4000-8000-0000000c0001'),
  '00000000-0000-4000-8000-0000000a0003'::uuid, 'the crew passes to the next member'
);

select * from finish();
rollback;
