-- SPIL-05: the failed bot check log (migration 1200).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_table('public', 'captcha_events', 'failed bot checks are logged');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.captcha_events'::regclass),
  'captcha_events has row level security'
);
select ok(not has_table_privilege('anon', 'public.captcha_events', 'select'), 'anon cannot read it');
select ok(
  not has_table_privilege('authenticated', 'public.captcha_events', 'insert'),
  'players cannot write it'
);
select hasnt_column('public', 'captcha_events', 'ip', 'no IP address is stored');
select throws_ok(
  $$ insert into public.captcha_events (endpoint, browser) values ('create_room', 'Mozilla/5.0') $$,
  '23514', null, 'only a browser family, never a user agent'
);

select * from finish();
rollback;
