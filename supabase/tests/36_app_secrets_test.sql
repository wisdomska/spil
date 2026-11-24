-- Server-made keys (migration 20261124000100): nobody but the server can read them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
select is((select relrowsecurity from pg_class where oid = 'public.app_secrets'::regclass), true, 'RLS is on');
select ok(not has_table_privilege('authenticated', 'public.app_secrets', 'select'), 'players cannot read keys');
select ok(not has_table_privilege('anon', 'public.app_secrets', 'select'), 'visitors cannot read keys');
select ok(not has_table_privilege('authenticated', 'public.app_secrets', 'insert'), 'players cannot write keys');
insert into public.app_secrets (key, value) values ('test_key', 'x');
select throws_ok($$insert into public.app_secrets (key, value) values ('test_key', 'y')$$, '23505', null, 'one value per key');
select * from finish();
rollback;
