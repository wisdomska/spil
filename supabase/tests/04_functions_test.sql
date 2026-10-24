-- Game and ops functions: start_round, advance_room (double advance),
-- save_results (idempotent), expire_rooms, check_rate_limit, nudge.
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
create function tests.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
end;
$$;
create function tests.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role postgres';
end;
$$;

-- Fixtures -------------------------------------------------------------------
-- Room R1 (AAAA): three players, classic pack.
insert into public.rooms (id, code, pack_id, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'AAAA', 'classic', '11111111-1111-1111-1111-111111111111');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed, age_confirmed) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Kofi', 1, 1, true),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Ama', 2, 2, true),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Tunde', 3, 3, true);
update public.rooms set host_player_id = 'c0000000-0000-0000-0000-000000000001' where id = 'b0000000-0000-0000-0000-000000000001';

-- Small pack: 3 live, 2 hidden, 1 draft question. Empty pack: no live questions.
insert into public.packs (id, name, blurb, icon, status) values
  ('t_small', 'Small', 'small pack', 'cards', 'live'),
  ('t_empty', 'Empty', 'empty pack', 'cards', 'live');
insert into public.questions (pack_id, text, status) values
  ('t_small', 'small live question one?', 'live'),
  ('t_small', 'small live question two?', 'live'),
  ('t_small', 'small live question three?', 'live'),
  ('t_small', 'small hidden question one?', 'hidden'),
  ('t_small', 'small hidden question two?', 'hidden'),
  ('t_small', 'small draft question one?', 'draft'),
  ('t_empty', 'empty pack hidden question?', 'hidden');

-- Room R2 (BBBB) for the draw tests, R3 (CCCC) for unavailable packs.
insert into public.rooms (id, code, pack_id, created_by) values
  ('b0000000-0000-0000-0000-000000000002', 'BBBB', 't_small', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000003', 'CCCC', 'classic', '11111111-1111-1111-1111-111111111111');

create temp table stats_before as
select coalesce((select games_started from public.stats_daily where day = (now() at time zone 'utc')::date), 0) as started,
       coalesce((select games_finished from public.stats_daily where day = (now() at time zone 'utc')::date), 0) as finished;

-- Privileges --------------------------------------------------------------------
select tests.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ select public.start_round('b0000000-0000-0000-0000-000000000001', 'classic', 5) $$,
  '42501', null, 'a player cannot call start_round'
);
select throws_ok(
  $$ select public.advance_room('b0000000-0000-0000-0000-000000000001', 'lobby', 'answering') $$,
  '42501', null, 'a player cannot call advance_room'
);
select throws_ok(
  $$ select public.save_results('b0000000-0000-0000-0000-000000000001', 1, '[]', '[]') $$,
  '42501', null, 'a player cannot call save_results'
);
select throws_ok($$ select public.expire_rooms() $$, '42501', null, 'a player cannot call expire_rooms');
select throws_ok(
  $$ select public.nudge('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'a player cannot call nudge'
);

-- start_round: first start ---------------------------------------------------------
select tests.as_service();
select lives_ok(
  $$ select public.start_round('b0000000-0000-0000-0000-000000000001', 'classic', 5) $$,
  'service role starts the first round'
);
select is((select round from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 1, 'first start keeps round 1');
select is((select status::text from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 'answering', 'first start moves the room to answering');
select isnt((select started_at from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), null, 'started_at is set');
select is(
  (select count(*)::int from public.room_questions where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1),
  5,
  'room draws questions-per-game questions'
);
select is(
  (select count(distinct question_id)::int from public.room_questions where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1),
  5,
  'drawn questions are unique'
);
select is(
  (
    select count(*)::int
    from public.room_questions rq
    join public.questions q on q.id = rq.question_id
    where rq.room_id = 'b0000000-0000-0000-0000-000000000001'
      and (q.pack_id <> 'classic' or q.status <> 'live')
  ),
  0,
  'drawn questions are live questions from the pack'
);
select results_eq(
  $$ select position from public.room_questions where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1 order by position $$,
  $$ values (1), (2), (3), (4), (5) $$,
  'positions run 1 to n'
);
select throws_ok(
  $$ select public.start_round('b0000000-0000-0000-0000-000000000001', 'classic', 5) $$,
  'P0001', 'WRONG_PHASE', 'start_round refuses a room that is already playing'
);

select tests.as_postgres();
select is(
  (select games_started from public.stats_daily where day = (now() at time zone 'utc')::date),
  (select started + 1 from stats_before),
  'starting a game counts in stats_daily'
);
select ok(
  exists (select 1 from public.pack_plays where pack_id = 'classic' and day = (now() at time zone 'utc')::date and started >= 1),
  'starting a game counts in pack_plays'
);

-- Answers: Kofi all yes, Ama all no, Tunde all skip.
insert into public.answers (player_id, room_id, round, question_id, value)
select p.id, rq.room_id, 1, rq.question_id,
       case p.nickname when 'Kofi' then 'yes'::public.answer_value when 'Ama' then 'no'::public.answer_value else 'skip'::public.answer_value end
from public.players p
join public.room_questions rq on rq.room_id = p.room_id and rq.round = 1
where p.room_id = 'b0000000-0000-0000-0000-000000000001';
update public.players set answers_submitted_at = now() where room_id = 'b0000000-0000-0000-0000-000000000001';

create temp table q_before as
select coalesce(sum(q.yes_count), 0)::int as yes_n, coalesce(sum(q.answered_count), 0)::int as answered_n
from public.questions q
where q.id in (select question_id from public.room_questions where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1);

-- advance_room: double advance ---------------------------------------------------------
select tests.as_service();
select lives_ok(
  $$ select public.advance_room('b0000000-0000-0000-0000-000000000001', 'answering', 'guessing') $$,
  'first advance answering to guessing wins'
);
select throws_ok(
  $$ select public.advance_room('b0000000-0000-0000-0000-000000000001', 'answering', 'guessing') $$,
  'P0001', 'WRONG_PHASE', 'second advance from the same phase gets WRONG_PHASE'
);
select is((select status::text from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 'guessing', 'room is guessing after the double advance');
select isnt((select guessing_at from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), null, 'guessing_at is set');
select is(
  (select (public.advance_room('b0000000-0000-0000-0000-000000000001', 'guessing', 'ready')).status::text),
  'ready',
  'advance_room returns the updated room'
);
select throws_ok(
  $$ select public.advance_room('b0000000-0000-0000-0000-000000000001', 'guessing', 'ready') $$,
  'P0001', 'WRONG_PHASE', 'second advance guessing to ready gets WRONG_PHASE'
);
select throws_ok(
  $$ select public.advance_room('b0000000-0000-0000-0000-000000000002', 'lobby', 'revealed') $$,
  'P0001', 'INVALID_TRANSITION', 'advance_room refuses skipping phases'
);
select throws_ok(
  $$ select public.advance_room('b0000000-0000-0000-0000-0000000000ff', 'lobby', 'answering') $$,
  'P0002', 'ROOM_NOT_FOUND', 'advance_room on a missing room'
);

-- save_results: idempotent -------------------------------------------------------------------
select lives_ok(
  $$ select public.save_results(
       'b0000000-0000-0000-0000-000000000001', 1,
       '[{"player_id":"c0000000-0000-0000-0000-000000000001","spill_score":100,"label":"Legendary Menace","avg_guess_about":60,"mind_reader":70,"rank":1},
         {"player_id":"c0000000-0000-0000-0000-000000000002","spill_score":0,"label":"Fresh Out The Box","avg_guess_about":30,"mind_reader":60,"rank":2},
         {"player_id":"c0000000-0000-0000-0000-000000000003","spill_score":0,"label":"Fresh Out The Box","avg_guess_about":40,"mind_reader":50,"rank":2}]'::jsonb,
       '[{"award":"top_spiller","player_id":"c0000000-0000-0000-0000-000000000001","reason":"Highest score in the room. 100 out of 100.","position":1},
         {"award":"saint","player_id":"c0000000-0000-0000-0000-000000000002","reason":"Scored 0. Either a saint or a very good liar.","position":2}]'::jsonb
     ) $$,
  'save_results stores a finished round'
);
select is((select count(*)::int from public.results where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1), 3, 'results stored');
select is((select count(*)::int from public.awards where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1), 2, 'awards stored');
select is((select status::text from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 'revealed', 'room is revealed');
select is((select final_round from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 1, 'final_round is set');
select isnt((select revealed_at from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), null, 'revealed_at is set');

select tests.as_postgres();
select is(
  (
    select sum(q.yes_count)::int
    from public.questions q
    where q.id in (select question_id from public.room_questions where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1)
  ),
  (select yes_n + 5 from q_before),
  'answer stats count yes answers'
);
select is(
  (
    select sum(q.answered_count)::int
    from public.questions q
    where q.id in (select question_id from public.room_questions where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1)
  ),
  (select answered_n + 10 from q_before),
  'answer stats count yes and no answers but not skips'
);
select is(
  (select games_finished from public.stats_daily where day = (now() at time zone 'utc')::date),
  (select finished + 1 from stats_before),
  'finishing counts in stats_daily'
);

select tests.as_service();
select lives_ok(
  $$ select public.save_results(
       'b0000000-0000-0000-0000-000000000001', 1,
       '[{"player_id":"c0000000-0000-0000-0000-000000000001","spill_score":100,"label":"Legendary Menace","avg_guess_about":60,"mind_reader":70,"rank":1}]'::jsonb,
       '[]'::jsonb
     ) $$,
  'a second save_results for the same round is a no-op'
);
select is((select count(*)::int from public.results where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1), 3, 'results unchanged after the repeat call');
select is((select count(*)::int from public.awards where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1), 2, 'awards unchanged after the repeat call');

select tests.as_postgres();
select is(
  (
    select sum(q.yes_count)::int
    from public.questions q
    where q.id in (select question_id from public.room_questions where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1)
  ),
  (select yes_n + 5 from q_before),
  'finishing counts once even if called twice (answer stats)'
);
select is(
  (select games_finished from public.stats_daily where day = (now() at time zone 'utc')::date),
  (select finished + 1 from stats_before),
  'finishing counts once even if called twice (stats_daily)'
);

select tests.as_service();
select throws_ok(
  $$ select public.save_results('b0000000-0000-0000-0000-000000000001', 2, '[]', '[]') $$,
  'P0001', 'WRONG_PHASE', 'save_results for a round that is not ready gets WRONG_PHASE'
);

-- start_round: rematch resets ------------------------------------------------------------------
select tests.as_postgres();
insert into public.guesses (guesser_id, target_id, room_id, round, value) values
  ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 1, 40);
update public.players set guesses_submitted_at = now() where room_id = 'b0000000-0000-0000-0000-000000000001';
update public.players set spill_mode = true where id = 'c0000000-0000-0000-0000-000000000002';
update public.players set status = 'sat_out' where id = 'c0000000-0000-0000-0000-000000000003';

select tests.as_service();
select lives_ok(
  $$ select public.start_round('b0000000-0000-0000-0000-000000000001', 'campus', 4) $$,
  'rematch with a pack switch starts the next round'
);
select is((select round from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 2, 'round goes up after a finished round');
select is((select status::text from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 'answering', 'rematch moves to answering');
select is((select pack_id from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 'campus', 'rematch switches the pack');
select is((select revealed_at from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), null, 'revealed_at is cleared');
select is((select count(*)::int from public.answers where room_id = 'b0000000-0000-0000-0000-000000000001'), 0, 'rematch clears answers');
select is((select count(*)::int from public.guesses where room_id = 'b0000000-0000-0000-0000-000000000001'), 0, 'rematch clears guesses');
select is(
  (
    select count(*)::int from public.players
    where room_id = 'b0000000-0000-0000-0000-000000000001'
      and (answers_submitted_at is not null or guesses_submitted_at is not null or spill_mode)
  ),
  0,
  'rematch resets submitted flags and Spill Mode'
);
select is((select status::text from public.players where id = 'c0000000-0000-0000-0000-000000000003'), 'active', 'sat out players are back in');
select is(
  (
    select count(*)::int
    from public.room_questions rq
    join public.questions q on q.id = rq.question_id
    where rq.room_id = 'b0000000-0000-0000-0000-000000000001' and rq.round = 2 and q.pack_id = 'campus'
  ),
  4,
  'new questions come from the new pack'
);
select is((select count(*)::int from public.results where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 1), 3, 'earlier round results are kept');

-- start_round: switching to an adult pack (SPIL-02 age bands) ------------------------------
select tests.as_postgres();
update public.rooms set status = 'revealed', final_round = 2 where id = 'b0000000-0000-0000-0000-000000000001';

-- Fixture players have the default band 13_15, so an 18+ pack is refused outright.
select tests.as_service();
select throws_ok(
  $$ select public.start_round('b0000000-0000-0000-0000-000000000001', 'afterdark', 5) $$,
  'P0001',
  'PACK_NOT_ALLOWED',
  'start_round refuses an 18+ pack while a player is under 18'
);
select is((select status::text from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 'revealed', 'refused switch leaves the room as it was');
select is((select pack_id from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 'classic', 'refused switch keeps the pack');

select tests.as_postgres();
update public.players set age_band = '18_plus' where room_id = 'b0000000-0000-0000-0000-000000000001';

select tests.as_service();
select lives_ok(
  $$ select public.start_round('b0000000-0000-0000-0000-000000000001', 'afterdark', 5) $$,
  'start_round starts an 18+ pack when everyone is 18 or older'
);
select is((select status::text from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 'answering', 'adult round is answering');
select is((select round from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 3, 'adult round opens the next round');
select is(
  (select count(*)::int from public.room_questions where room_id = 'b0000000-0000-0000-0000-000000000001' and round = 3),
  5,
  'adult round draws its questions'
);

-- start_round: draw rules ----------------------------------------------------------------------------
select tests.as_postgres();
insert into public.players (room_id, user_id, nickname, avatar, rotation_seed) values
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Kofi', 1, 1),
  ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Kofi', 1, 1);

select tests.as_service();
select lives_ok(
  $$ select public.start_round('b0000000-0000-0000-0000-000000000002', 't_small', 100) $$,
  'start_round with more requested than available'
);
select is(
  (select count(*)::int from public.room_questions where room_id = 'b0000000-0000-0000-0000-000000000002'),
  3,
  'draws all live questions when the pack has fewer than requested'
);
select is(
  (
    select count(*)::int
    from public.room_questions rq
    join public.questions q on q.id = rq.question_id
    where rq.room_id = 'b0000000-0000-0000-0000-000000000002' and q.status <> 'live'
  ),
  0,
  'hidden and draft questions are never drawn'
);
select throws_ok(
  $$ select public.start_round('b0000000-0000-0000-0000-000000000003', 'purity', 5) $$,
  'P0001', 'PACK_UNAVAILABLE', 'draft packs cannot be started'
);
select throws_ok(
  $$ select public.start_round('b0000000-0000-0000-0000-000000000003', 't_empty', 5) $$,
  'P0001', 'PACK_UNAVAILABLE', 'packs with no live questions cannot be started'
);
select is((select status::text from public.rooms where id = 'b0000000-0000-0000-0000-000000000003'), 'lobby', 'a failed start leaves the room in lobby');

-- nudge ---------------------------------------------------------------------------------------------------
select lives_ok(
  $$ select public.nudge('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002') $$,
  'service role can nudge a player in the room'
);
select throws_ok(
  $$ select public.nudge('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002') $$,
  'P0002', 'PLAYER_NOT_FOUND', 'nudge refuses a player from another room'
);

-- check_rate_limit -------------------------------------------------------------------------------------------
select is(public.check_rate_limit('test:limit', 2, interval '1 hour'), true, 'first hit is within the limit');
select is(public.check_rate_limit('test:limit', 2, interval '1 hour'), true, 'second hit is within the limit');
select is(public.check_rate_limit('test:limit', 2, interval '1 hour'), false, 'third hit is over the limit');
select is(public.check_rate_limit('test:other', 2, interval '1 hour'), true, 'keys are counted separately');
select throws_ok(
  $$ select public.check_rate_limit('test:limit', 2, interval '0 seconds') $$,
  '22023', 'INVALID_RATE_LIMIT', 'a zero window is refused'
);

-- expire_rooms -------------------------------------------------------------------------------------------------
select tests.as_postgres();
insert into public.rooms (id, code, pack_id, created_by, status, created_at, expires_at) values
  ('e0000000-0000-0000-0000-000000000001', 'EEEE', 'classic', '11111111-1111-1111-1111-111111111111', 'lobby', now() - interval '25 hours', now() + interval '6 days'),
  ('e0000000-0000-0000-0000-000000000002', 'FFFF', 'classic', '11111111-1111-1111-1111-111111111111', 'lobby', now() - interval '1 hour', now() + interval '6 days'),
  ('e0000000-0000-0000-0000-000000000003', 'GGGG', 'classic', '11111111-1111-1111-1111-111111111111', 'answering', now() - interval '25 hours', now() + interval '6 days'),
  ('e0000000-0000-0000-0000-000000000004', 'HHHH', 'classic', '11111111-1111-1111-1111-111111111111', 'revealed', now() - interval '8 days', now() - interval '1 day');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed) values
  ('e1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666666', 'Esi', 1, 1),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', '77777777-7777-7777-7777-777777777777', 'Femi', 1, 1);
update public.rooms set host_player_id = 'e1000000-0000-0000-0000-000000000004' where id = 'e0000000-0000-0000-0000-000000000004';

insert into auth.users (id, aud, role, is_anonymous, created_at, last_sign_in_at) values
  ('66666666-6666-6666-6666-666666666666', 'authenticated', 'authenticated', true, now() - interval '40 days', now() - interval '31 days'),
  ('77777777-7777-7777-7777-777777777777', 'authenticated', 'authenticated', true, now() - interval '40 days', now() - interval '31 days'),
  ('88888888-8888-8888-8888-888888888888', 'authenticated', 'authenticated', true, now() - interval '2 days', now() - interval '1 day');
insert into auth.users (id, email, aud, role, is_anonymous, created_at, last_sign_in_at) values
  ('99999999-9999-9999-9999-999999999999', 'old@test.local', 'authenticated', 'authenticated', false, now() - interval '400 days', now() - interval '300 days');
insert into public.rate_limits (key, window_start, count) values ('test:old', now() - interval '2 days', 5);

select tests.as_service();
select lives_ok($$ select public.expire_rooms() $$, 'service role runs expire_rooms');

select is((select status::text from public.rooms where id = 'e0000000-0000-0000-0000-000000000001'), 'closed', 'rooms older than 24 h expire (lobby closed)');
select is((select status::text from public.rooms where id = 'e0000000-0000-0000-0000-000000000002'), 'lobby', 'a fresh lobby stays open');
select is((select status::text from public.rooms where id = 'e0000000-0000-0000-0000-000000000003'), 'answering', 'a game in progress is not closed');
select ok(not exists (select 1 from public.rooms where id = 'e0000000-0000-0000-0000-000000000004'), 'rooms past expires_at are deleted');
select ok(not exists (select 1 from public.players where id = 'e1000000-0000-0000-0000-000000000004'), 'deleting a room deletes its players');
select ok(exists (select 1 from public.rooms where id = 'b0000000-0000-0000-0000-000000000001'), 'live rooms are kept');
select ok(not exists (select 1 from public.rate_limits where key = 'test:old'), 'old rate limit windows are removed');

select tests.as_postgres();
select ok(not exists (select 1 from auth.users where id = '66666666-6666-6666-6666-666666666666'), 'stale anonymous users without players are deleted');
select ok(exists (select 1 from auth.users where id = '77777777-7777-7777-7777-777777777777'), 'anonymous users who still have a player are kept');
select ok(exists (select 1 from auth.users where id = '88888888-8888-8888-8888-888888888888'), 'recent anonymous users are kept');
select ok(exists (select 1 from auth.users where id = '99999999-9999-9999-9999-999999999999'), 'non-anonymous users are kept');

select tests.as_service();
select is(
  (public.expire_rooms() ->> 'deleted')::int,
  0,
  'expire_rooms is safe to run again'
);

select * from finish();
rollback;
