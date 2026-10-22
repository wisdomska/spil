-- RLS: rooms, room_questions, players (players_public), answers, guesses,
-- results, awards and the realtime topic check (docs/TECH_SPEC.md sections 10, 11).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Identity helpers -----------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;
create function tests.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end;
$$;
create function tests.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role postgres';
end;
$$;

-- Fixtures -------------------------------------------------------------------
-- Users: 1111 host, 2222 and 3333 members of room A, 4444 only in room B,
-- a..01 owner, a..02 content_lead, a..03 moderator.
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000002', 'content@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000003', 'mod@test.local', 'authenticated', 'authenticated');
insert into public.admins (user_id, email, name, role) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test.local', 'Owner', 'owner'),
  ('a0000000-0000-0000-0000-000000000002', 'content@test.local', 'Content', 'content_lead'),
  ('a0000000-0000-0000-0000-000000000003', 'mod@test.local', 'Mod', 'moderator');

insert into public.rooms (id, code, pack_id, created_by, status) values
  ('b0000000-0000-0000-0000-00000000000a', 'ABCD', 'classic', '11111111-1111-1111-1111-111111111111', 'guessing'),
  ('b0000000-0000-0000-0000-00000000000b', 'WXYZ', 'classic', '44444444-4444-4444-4444-444444444444', 'lobby');

insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Kofi', 1, 1),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'Ama', 2, 2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000a', '33333333-3333-3333-3333-333333333333', 'Tunde', 3, 3),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-00000000000b', '44444444-4444-4444-4444-444444444444', 'Ngozi', 4, 4);
-- A player who left room A no longer counts as a member.
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed, status) values
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-00000000000a', '55555555-5555-5555-5555-555555555555', 'Yaw', 5, 5, 'left');

update public.rooms set host_player_id = 'c0000000-0000-0000-0000-000000000001' where id = 'b0000000-0000-0000-0000-00000000000a';
update public.rooms set host_player_id = 'c0000000-0000-0000-0000-000000000004' where id = 'b0000000-0000-0000-0000-00000000000b';

insert into public.room_questions (room_id, round, position, question_id)
select 'b0000000-0000-0000-0000-00000000000a', 1, row_number() over (order by q.id), q.id
from (select id from public.questions where pack_id = 'classic' and status = 'live' order by id limit 3) q;

insert into public.answers (player_id, room_id, round, question_id, value)
select p.id, 'b0000000-0000-0000-0000-00000000000a', 1, rq.question_id, 'yes'
from public.players p
cross join public.room_questions rq
where p.room_id = 'b0000000-0000-0000-0000-00000000000a'
  and p.status = 'active'
  and rq.room_id = 'b0000000-0000-0000-0000-00000000000a';

insert into public.guesses (guesser_id, target_id, room_id, round, value) values
  ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a', 1, 40),
  ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000a', 1, 50),
  ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000a', 1, 60),
  ('c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000a', 1, 70);

insert into public.results (room_id, round, player_id, spill_score, label, avg_guess_about, mind_reader, rank) values
  ('b0000000-0000-0000-0000-00000000000a', 1, 'c0000000-0000-0000-0000-000000000001', 100, 'Legendary Menace', 65, 80, 1);
insert into public.awards (room_id, round, award, player_id, reason, position) values
  ('b0000000-0000-0000-0000-00000000000a', 1, 'top_spiller', 'c0000000-0000-0000-0000-000000000001', 'Highest score in the room. 100 out of 100.', 1);

-- rooms ------------------------------------------------------------------------
select tests.as_anon();
select is((select count(*)::int from public.rooms), 0, 'anon sees no rooms');

select tests.as_user('22222222-2222-2222-2222-222222222222');
select results_eq(
  $$ select id from public.rooms $$,
  $$ values ('b0000000-0000-0000-0000-00000000000a'::uuid) $$,
  'member sees only their room'
);
select throws_ok(
  $$ insert into public.rooms (code, pack_id, created_by) values ('HJKL', 'classic', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'member cannot create rooms directly'
);
select throws_ok(
  $$ update public.rooms set status = 'revealed' $$,
  '42501', null, 'member cannot update rooms'
);

select tests.as_user('44444444-4444-4444-4444-444444444444');
select results_eq(
  $$ select id from public.rooms $$,
  $$ values ('b0000000-0000-0000-0000-00000000000b'::uuid) $$,
  'non-member of room A sees only room B'
);

select tests.as_user('55555555-5555-5555-5555-555555555555');
select is((select count(*)::int from public.rooms), 0, 'a player who left no longer sees the room');

select tests.as_user('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.rooms where code in ('ABCD', 'WXYZ')), 2, 'owner sees all rooms');
select tests.as_user('a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.rooms where code in ('ABCD', 'WXYZ')), 2, 'content lead sees all rooms');
select tests.as_user('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.rooms where code in ('ABCD', 'WXYZ')), 2, 'moderator sees all rooms');

-- room_questions -------------------------------------------------------------------
select tests.as_anon();
select is((select count(*)::int from public.room_questions), 0, 'anon sees no room questions');
select tests.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.room_questions), 3, 'member sees the room questions');
select tests.as_user('44444444-4444-4444-4444-444444444444');
select is((select count(*)::int from public.room_questions), 0, 'non-member sees no room questions');

-- players and players_public ----------------------------------------------------------
select tests.as_anon();
select is((select count(*)::int from public.players_public), 0, 'anon sees no players');

select tests.as_user('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.players_public where room_id = 'b0000000-0000-0000-0000-00000000000a'),
  4,
  'member sees every player in their room'
);
select is(
  (select count(*)::int from public.players_public where room_id = 'b0000000-0000-0000-0000-00000000000b'),
  0,
  'member does not see players in other rooms'
);
select is(
  (select nickname from public.players_public where is_host),
  'Kofi',
  'players_public flags the host'
);
select is(
  (select count(*)::int from public.players_public where not answers_submitted),
  4,
  'players_public exposes submitted flags'
);
select throws_ok(
  $$ select user_id from public.players $$,
  '42501', null, 'member cannot read player user ids'
);
select throws_ok(
  $$ select age_confirmed from public.players $$,
  '42501', null, 'member cannot read age confirmation'
);
select throws_ok(
  $$ update public.players set spill_mode = true $$,
  '42501', null, 'member cannot update players'
);

select tests.as_user('44444444-4444-4444-4444-444444444444');
select is(
  (select count(*)::int from public.players_public where room_id = 'b0000000-0000-0000-0000-00000000000a'),
  0,
  'non-member sees no players of room A'
);

-- answers before the reveal ---------------------------------------------------------------
select tests.as_anon();
select is((select count(*)::int from public.answers), 0, 'anon sees no answers');

select tests.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.answers), 3, 'member sees only their own answers');
select is(
  (select count(*)::int from public.answers where player_id <> 'c0000000-0000-0000-0000-000000000002'),
  0,
  'member sees no one else''s answers before the reveal'
);
select throws_ok(
  $$ insert into public.answers (player_id, room_id, round, question_id, value)
     select 'c0000000-0000-0000-0000-000000000002', room_id, 1, question_id, 'no'
     from public.room_questions limit 1 $$,
  '42501', null, 'member cannot write answers directly'
);

select tests.as_user('44444444-4444-4444-4444-444444444444');
select is((select count(*)::int from public.answers), 0, 'non-member sees no answers');

-- guesses before the reveal ---------------------------------------------------------------
select tests.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.guesses), 2, 'member sees only their own guesses');
select is(
  (select count(*)::int from public.guesses where guesser_id <> 'c0000000-0000-0000-0000-000000000001'),
  0,
  'member sees no one else''s guesses before the reveal'
);
select tests.as_anon();
select is((select count(*)::int from public.guesses), 0, 'anon sees no guesses');

-- results and awards before the reveal -------------------------------------------------------
select tests.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.results), 0, 'member sees no results before the reveal');
select is((select count(*)::int from public.awards), 0, 'member sees no awards before the reveal');

-- Reveal: Ama turns Spill Mode on, Tunde does not ---------------------------------------------
select tests.as_postgres();
update public.players set spill_mode = true where id = 'c0000000-0000-0000-0000-000000000002';
update public.rooms set status = 'revealed' where id = 'b0000000-0000-0000-0000-00000000000a';

-- answers after the reveal
select tests.as_user('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.answers where player_id = 'c0000000-0000-0000-0000-000000000002'),
  3,
  'after the reveal a member sees answers of a player with Spill Mode on'
);
select is(
  (select count(*)::int from public.answers where player_id = 'c0000000-0000-0000-0000-000000000003'),
  0,
  'after the reveal a member does not see answers of a player with Spill Mode off'
);
select is(
  (select count(*)::int from public.answers where player_id = 'c0000000-0000-0000-0000-000000000001'),
  3,
  'a member still sees their own answers'
);

select tests.as_user('44444444-4444-4444-4444-444444444444');
select is((select count(*)::int from public.answers), 0, 'non-member sees no answers after the reveal');
select tests.as_anon();
select is((select count(*)::int from public.answers), 0, 'anon sees no answers after the reveal');

-- guesses after the reveal
select tests.as_user('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from public.guesses), 4, 'after the reveal a member sees all room guesses');
select tests.as_user('44444444-4444-4444-4444-444444444444');
select is((select count(*)::int from public.guesses), 0, 'non-member sees no guesses after the reveal');

-- results and awards after the reveal
select tests.as_user('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from public.results), 1, 'member sees results after the reveal');
select is((select count(*)::int from public.awards), 1, 'member sees awards after the reveal');
select tests.as_user('44444444-4444-4444-4444-444444444444');
select is((select count(*)::int from public.results), 0, 'non-member sees no results');
select is((select count(*)::int from public.awards), 0, 'non-member sees no awards');
select tests.as_anon();
select is((select count(*)::int from public.results), 0, 'anon sees no results');
select is((select count(*)::int from public.awards), 0, 'anon sees no awards');

-- Realtime topic check (used by the realtime.messages policies) ----------------------------------
select tests.as_user('22222222-2222-2222-2222-222222222222');
select ok(public.can_access_room_topic('room:b0000000-0000-0000-0000-00000000000a'), 'member may join their room channel');
select ok(not public.can_access_room_topic('room:b0000000-0000-0000-0000-00000000000b'), 'member may not join another room channel');
select ok(not public.can_access_room_topic('room:not-a-uuid'), 'malformed topics are refused');
select ok(not public.can_access_room_topic('lobby'), 'non-room topics are refused');
select tests.as_anon();
select ok(not public.can_access_room_topic('room:b0000000-0000-0000-0000-00000000000a'), 'anon may not join a room channel');

select * from finish();
rollback;
