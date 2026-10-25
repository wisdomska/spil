-- Crews and seasons (migration 2900).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'crews', 'crews are stored');
select has_table('public', 'crew_members', 'crew members are stored');
select has_table('public', 'crew_rounds', 'crew rounds outlive their rooms');
select has_column('public', 'rooms', 'crew_id', 'a room can play as a crew');
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.crews'::regclass, 'public.crew_members'::regclass, 'public.crew_rounds'::regclass)),
  'every crew table has row level security'
);
select policies_are('public', 'crews', array['crews_select_member'], 'only members read a crew');
select policies_are('public', 'crew_members', array['crew_members_select_member'], 'only members read the members');
select policies_are('public', 'crew_rounds', array['crew_rounds_select_member'], 'only members read the history');
select ok(not has_table_privilege('anon', 'public.crews', 'select'), 'anon cannot read crews');
select ok(not has_table_privilege('authenticated', 'public.crew_members', 'insert'), 'players join through the API');

-- A member sees the crew; someone else does not.
insert into public.crews (id, name, invite_token, created_by)
values ('00000000-0000-4000-8000-0000000000b1', 'Lagos Fam', 'invite-token-1234567890', '00000000-0000-4000-8000-00000000aa01');
insert into public.crew_members (crew_id, user_id, nickname)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000aa01', 'Ama');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000aa01","role":"authenticated"}', true);
select is((select count(*)::int from public.crews), 1, 'a member sees their crew');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000aa02","role":"authenticated"}', true);
select is((select count(*)::int from public.crews), 0, 'someone else does not');
reset role;

select * from finish();
rollback;
