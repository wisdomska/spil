-- RLS: reports, messages, admins, audit_log, rate_limits, stats_daily,
-- pack_plays (docs/TECH_SPEC.md section 10).
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
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000002', 'content@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000003', 'mod@test.local', 'authenticated', 'authenticated');
insert into public.admins (user_id, email, name, role) values
  ('a0000000-0000-0000-0000-000000000001', 'owner@test.local', 'Owner', 'owner'),
  ('a0000000-0000-0000-0000-000000000002', 'content@test.local', 'Content', 'content_lead'),
  ('a0000000-0000-0000-0000-000000000003', 'mod@test.local', 'Mod', 'moderator');

insert into public.reports (type, reason, reporter_user_id) values ('other', 'test report', '22222222-2222-2222-2222-222222222222');
insert into public.messages (name, body) values ('Esi', 'Hello from the contact form');
insert into public.audit_log (admin_user_id, who, action, target) values ('a0000000-0000-0000-0000-000000000001', 'Owner', 'Edited pack', 'classic');
insert into public.rate_limits (key, window_start, count) values ('join:test', now(), 1);
insert into public.stats_daily (day, games_started) values (date '2000-01-01', 3);
insert into public.pack_plays (pack_id, day, started) values ('classic', date '2000-01-01', 3);

-- Anyone who is not an admin sees nothing --------------------------------------
select tests.as_anon();
select is((select count(*)::int from public.reports), 0, 'anon sees no reports');
select is((select count(*)::int from public.messages), 0, 'anon sees no messages');
select is((select count(*)::int from public.admins), 0, 'anon sees no admins');
select is((select count(*)::int from public.audit_log), 0, 'anon sees no audit log');
select is((select count(*)::int from public.stats_daily), 0, 'anon sees no stats');
select is((select count(*)::int from public.pack_plays), 0, 'anon sees no pack plays');
select throws_ok($$ select * from public.rate_limits $$, '42501', null, 'anon cannot read rate limits');
select throws_ok(
  $$ insert into public.messages (body) values ('sneaky direct insert') $$,
  '42501', null, 'anon cannot insert messages directly'
);

select tests.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.reports), 0, 'player sees no reports');
select is((select count(*)::int from public.messages), 0, 'player sees no messages');
select is((select count(*)::int from public.admins), 0, 'player sees no admins');
select is((select count(*)::int from public.audit_log), 0, 'player sees no audit log');
select is((select count(*)::int from public.stats_daily), 0, 'player sees no stats');
select is((select count(*)::int from public.pack_plays), 0, 'player sees no pack plays');
select throws_ok($$ select * from public.rate_limits $$, '42501', null, 'player cannot read rate limits');
select throws_ok(
  $$ insert into public.reports (type, reason, reporter_user_id) values ('other', 'direct', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'player cannot insert reports directly'
);
select throws_ok(
  $$ insert into public.admins (user_id, email, name, role) values ('22222222-2222-2222-2222-222222222222', 'me@test.local', 'Me', 'owner') $$,
  '42501', null, 'player cannot make themselves an admin'
);

-- Every admin role can read ops tables ---------------------------------------------
select tests.as_user('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.reports), 1, 'owner sees reports');
select is((select count(*)::int from public.messages), 1, 'owner sees messages');
select is((select count(*)::int from public.admins), 3, 'owner sees admins');
select is((select count(*)::int from public.audit_log where target = 'classic'), 1, 'owner sees the audit log');
select is((select count(*)::int from public.stats_daily where day = date '2000-01-01'), 1, 'owner sees stats');
select is((select count(*)::int from public.pack_plays where day = date '2000-01-01'), 1, 'owner sees pack plays');
select throws_ok($$ select * from public.rate_limits $$, '42501', null, 'owner cannot read rate limits');
select throws_ok(
  $$ insert into public.audit_log (who, action, target) values ('Owner', 'forged', 'x') $$,
  '42501', null, 'owner cannot write the audit log from the client'
);

select tests.as_user('a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.reports), 1, 'content lead sees reports');
select is((select count(*)::int from public.messages), 1, 'content lead sees messages');
select is((select count(*)::int from public.admins), 3, 'content lead sees admins');
select is((select count(*)::int from public.audit_log where target = 'classic'), 1, 'content lead sees the audit log');
select is((select count(*)::int from public.stats_daily where day = date '2000-01-01'), 1, 'content lead sees stats');
select is((select count(*)::int from public.pack_plays where day = date '2000-01-01'), 1, 'content lead sees pack plays');

select tests.as_user('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.reports), 1, 'moderator sees reports');
select is((select count(*)::int from public.messages), 1, 'moderator sees messages');
select is((select count(*)::int from public.admins), 3, 'moderator sees admins');
select is((select count(*)::int from public.audit_log where target = 'classic'), 1, 'moderator sees the audit log');
select is((select count(*)::int from public.stats_daily where day = date '2000-01-01'), 1, 'moderator sees stats');
select is((select count(*)::int from public.pack_plays where day = date '2000-01-01'), 1, 'moderator sees pack plays');
select throws_ok(
  $$ update public.reports set status = 'dismissed' $$,
  '42501', null, 'moderator cannot update reports from the client'
);

select * from finish();
rollback;
