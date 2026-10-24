-- RLS: packs, questions, settings, feature_flags (docs/TECH_SPEC.md section 10).
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
-- a..01 owner, a..02 content_lead, a..03 moderator, 2222.. plain player
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000002', 'content@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000003', 'mod@test.local', 'authenticated', 'authenticated');
insert into public.admins (user_id, email, name, role) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test.local', 'Owner', 'owner'),
  ('a0000000-0000-0000-0000-000000000002', 'content@test.local', 'Content', 'content_lead'),
  ('a0000000-0000-0000-0000-000000000003', 'mod@test.local', 'Mod', 'moderator');

insert into public.packs (id, name, blurb, icon, status) values
  ('t_live', 'Test live', 'live pack', 'cards', 'live'),
  ('t_hidden', 'Test hidden', 'hidden pack', 'cards', 'hidden');
insert into public.questions (id, pack_id, text, status) values
  ('d0000000-0000-0000-0000-000000000001', 't_live', 'live question in a live pack?', 'live'),
  ('d0000000-0000-0000-0000-000000000002', 't_live', 'hidden question in a live pack?', 'hidden'),
  ('d0000000-0000-0000-0000-000000000003', 't_live', 'draft question in a live pack?', 'draft'),
  ('d0000000-0000-0000-0000-000000000004', 't_hidden', 'live question in a hidden pack?', 'live');

-- packs: select ---------------------------------------------------------------
select tests.as_anon();
select is((select count(*)::int from public.packs where status <> 'live'), 0, 'anon sees only live packs');
select ok(exists (select 1 from public.packs where id = 't_live'), 'anon sees a live pack');
select ok(not exists (select 1 from public.packs where id = 'purity'), 'anon does not see the draft purity pack');

select tests.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.packs where status <> 'live'), 0, 'player sees only live packs');

select tests.as_user('a0000000-0000-0000-0000-000000000001');
select ok(exists (select 1 from public.packs where id = 't_hidden'), 'owner sees hidden packs');
select tests.as_user('a0000000-0000-0000-0000-000000000002');
select ok(exists (select 1 from public.packs where id = 'purity'), 'content lead sees draft packs');
select tests.as_user('a0000000-0000-0000-0000-000000000003');
select ok(exists (select 1 from public.packs where id = 't_hidden'), 'moderator sees hidden packs');

-- packs: writes ----------------------------------------------------------------
select tests.as_anon();
select throws_ok(
  $$ insert into public.packs (id, name, blurb, icon) values ('t_anon', 'Anon pack', 'x', 'cards') $$,
  '42501', null, 'anon cannot insert packs'
);

select tests.as_user('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ insert into public.packs (id, name, blurb, icon) values ('t_player', 'Player pack', 'x', 'cards') $$,
  '42501', null, 'player cannot insert packs'
);
update public.packs set name = 'Hacked' where id = 't_live';

select tests.as_user('a0000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ insert into public.packs (id, name, blurb, icon) values ('t_mod', 'Mod pack', 'x', 'cards') $$,
  '42501', null, 'moderator cannot insert packs'
);
update public.packs set name = 'Mod edit' where id = 't_live';
delete from public.packs where id = 't_hidden';

select tests.as_postgres();
select is((select name from public.packs where id = 't_live'), 'Test live', 'player and moderator updates to packs are ignored');
select ok(exists (select 1 from public.packs where id = 't_hidden'), 'moderator cannot delete packs');

select tests.as_user('a0000000-0000-0000-0000-000000000002');
select lives_ok(
  $$ insert into public.packs (id, name, blurb, icon) values ('t_cl', 'CL pack', 'x', 'cards') $$,
  'content lead can insert packs'
);
update public.packs set name = 'CL edit' where id = 't_live';

select tests.as_user('a0000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ insert into public.packs (id, name, blurb, icon) values ('t_owner', 'Owner pack', 'x', 'cards') $$,
  'owner can insert packs'
);
delete from public.packs where id = 't_cl';

select tests.as_postgres();
select is((select name from public.packs where id = 't_live'), 'CL edit', 'content lead can update packs');
select ok(not exists (select 1 from public.packs where id = 't_cl'), 'owner can delete packs');

-- questions: select -------------------------------------------------------------
select tests.as_anon();
select ok(exists (select 1 from public.questions where id = 'd0000000-0000-0000-0000-000000000001'), 'anon sees live questions in live packs');
select ok(not exists (select 1 from public.questions where id = 'd0000000-0000-0000-0000-000000000002'), 'anon does not see hidden questions');
select ok(not exists (select 1 from public.questions where id = 'd0000000-0000-0000-0000-000000000003'), 'anon does not see draft questions');
select ok(not exists (select 1 from public.questions where id = 'd0000000-0000-0000-0000-000000000004'), 'anon does not see live questions in a hidden pack');
select is((select count(*)::int from public.questions where pack_id = 'purity'), 0, 'anon does not see draft pack questions');

select tests.as_user('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.questions where id in ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004')),
  0,
  'player does not see hidden questions or questions in hidden packs'
);

select tests.as_user('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.questions where pack_id in ('t_live', 't_hidden')), 4, 'owner sees every question');
select tests.as_user('a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.questions where pack_id in ('t_live', 't_hidden')), 4, 'content lead sees every question');
select tests.as_user('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.questions where pack_id in ('t_live', 't_hidden')), 4, 'moderator sees every question');

-- questions: writes -----------------------------------------------------------------
select tests.as_user('22222222-2222-2222-2222-222222222222');
select throws_ok(
  $$ insert into public.questions (pack_id, text) values ('t_live', 'player wrote a question?') $$,
  '42501', null, 'player cannot insert questions'
);

select tests.as_user('a0000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ insert into public.questions (pack_id, text) values ('t_live', 'moderator wrote a question?') $$,
  '42501', null, 'moderator cannot insert questions'
);
select throws_ok(
  $$ update public.questions set text = 'moderator rewrote this one?' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'moderator cannot edit question text'
);
select throws_ok(
  $$ update public.questions set text = 'moderator rewrote and hid it?', status = 'hidden' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'moderator cannot edit text even while hiding'
);
select lives_ok(
  $$ update public.questions set status = 'hidden' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  'moderator can hide a question'
);
delete from public.questions where id = 'd0000000-0000-0000-0000-000000000003';

select tests.as_postgres();
select is((select status::text from public.questions where id = 'd0000000-0000-0000-0000-000000000001'), 'hidden', 'moderator hide took effect');
select ok(exists (select 1 from public.questions where id = 'd0000000-0000-0000-0000-000000000003'), 'moderator cannot delete questions');

select tests.as_user('a0000000-0000-0000-0000-000000000002');
select lives_ok(
  $$ update public.questions set text = 'content lead rewrote this?', status = 'live' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  'content lead can edit questions'
);
select lives_ok(
  $$ insert into public.questions (pack_id, text) values ('t_live', 'content lead wrote a question?') $$,
  'content lead can insert questions'
);

select tests.as_user('a0000000-0000-0000-0000-000000000001');
delete from public.questions where id = 'd0000000-0000-0000-0000-000000000003';

select tests.as_postgres();
select is((select text from public.questions where id = 'd0000000-0000-0000-0000-000000000001'), 'content lead rewrote this?', 'content lead edit took effect');
select ok(not exists (select 1 from public.questions where id = 'd0000000-0000-0000-0000-000000000003'), 'owner can delete questions');

-- settings ------------------------------------------------------------------------------
select tests.as_anon();
select is((select questions_per_game from public.settings), 10, 'anon can read settings');

select tests.as_user('22222222-2222-2222-2222-222222222222');
update public.settings set questions_per_game = 50;
select tests.as_user('a0000000-0000-0000-0000-000000000002');
update public.settings set questions_per_game = 40;
select tests.as_user('a0000000-0000-0000-0000-000000000003');
update public.settings set questions_per_game = 30;

select tests.as_postgres();
select is((select questions_per_game from public.settings), 10, 'only the owner can update settings');

select tests.as_user('a0000000-0000-0000-0000-000000000001');
update public.settings set questions_per_game = 20;
select tests.as_postgres();
select is((select questions_per_game from public.settings), 20, 'owner can update settings');

select tests.as_user('a0000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ insert into public.settings (id) values (true) $$,
  '42501', null, 'settings rows cannot be inserted by clients'
);

-- feature_flags ---------------------------------------------------------------------------
select tests.as_anon();
select is((select count(*)::int from public.feature_flags), 5, 'anon can read feature flags');

select tests.as_user('22222222-2222-2222-2222-222222222222');
update public.feature_flags set enabled = true where key = 'party_mode';
select throws_ok(
  $$ insert into public.feature_flags (key, enabled) values ('player_flag', true) $$,
  '42501', null, 'player cannot insert feature flags'
);
select tests.as_user('a0000000-0000-0000-0000-000000000002');
update public.feature_flags set enabled = true where key = 'party_mode';
select throws_ok(
  $$ insert into public.feature_flags (key, enabled) values ('cl_flag', true) $$,
  '42501', null, 'content lead cannot insert feature flags'
);
select tests.as_user('a0000000-0000-0000-0000-000000000003');
update public.feature_flags set enabled = true where key = 'party_mode';

select tests.as_postgres();
select is((select enabled from public.feature_flags where key = 'party_mode'), false, 'only the owner can update feature flags');

select tests.as_user('a0000000-0000-0000-0000-000000000001');
update public.feature_flags set enabled = true where key = 'party_mode';
select lives_ok(
  $$ insert into public.feature_flags (key, enabled) values ('owner_flag', true) $$,
  'owner can insert feature flags'
);
select tests.as_postgres();
select is((select enabled from public.feature_flags where key = 'party_mode'), true, 'owner can update feature flags');

select * from finish();
rollback;
