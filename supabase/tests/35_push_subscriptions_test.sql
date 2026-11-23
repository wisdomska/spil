-- Push subscriptions (migration 20261123000100): server only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select is((select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass), true, 'RLS is on');
select ok(not has_table_privilege('authenticated', 'public.push_subscriptions', 'select'), 'players cannot read subscriptions');
select ok(not has_table_privilege('authenticated', 'public.push_subscriptions', 'insert'), 'players cannot write subscriptions');
select ok(not has_table_privilege('anon', 'public.push_subscriptions', 'select'), 'visitors cannot read subscriptions');

insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at)
values ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now());
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-4000-8000-0000000d0001', 'https://push.example/abc', repeat('k', 60), repeat('a', 20));

select is((select game_updates and daily from public.push_subscriptions where endpoint = 'https://push.example/abc'), true, 'both kinds are on by default');
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-4000-8000-0000000d0001', 'https://push.example/abc', 'x', 'y')$$,
  '23505', null, 'one row per device'
);
delete from auth.users where id = '00000000-0000-4000-8000-0000000d0001';
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/abc'), 0, 'deleting the person removes their devices');

select * from finish();
rollback;
