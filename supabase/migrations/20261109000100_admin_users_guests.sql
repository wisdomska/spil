-- Admin console, Users (owner request 2026-11-09): guests are listed next to accounts, under the
-- name they last played with and a Guest tag, and the summary counts guests who actually played.
-- A guest is one anonymous session, so one phone and browser: the same person on two phones, or
-- after clearing their browser, counts twice. IP addresses are not used: a party shares one wifi,
-- so a whole room would count as one guest, and SPIL does not store IP addresses (privacy policy).
-- Rollback: supabase/rollbacks/20261109000100_admin_users_guests.down.sql

-- Looking up a guest's rooms by user goes through this.
create index if not exists players_user_idx on public.players (user_id);

create or replace function public.admin_accounts(p_query text, p_filter text, p_limit int, p_offset int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pattern text := '%' || replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_week timestamptz := now() - interval '7 days';
  v_total int;
  v_rows jsonb;
begin
  with people as (
    -- Accounts: a username and password.
    select p.user_id, 'account'::text as kind, p.username as name, p.created_at,
           greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = p.user_id),
                    (select max(pl.last_seen_at) from public.players pl where pl.user_id = p.user_id)) as last_seen
    from public.profiles p
    join auth.users u on u.id = p.user_id
    union all
    -- Guests who played: joined a room (not as a test bot) or answered Today's Spill.
    select u.id, 'guest', (
             select pl.nickname from public.players pl
             where pl.user_id = u.id and not pl.is_bot
             order by pl.joined_at desc limit 1
           ), u.created_at,
           greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = u.id),
                    (select max(pl.last_seen_at) from public.players pl where pl.user_id = u.id),
                    (select max(d.created_at) from public.daily_answers d where d.user_id = u.id))
    from auth.users u
    where u.is_anonymous
      and not exists (select 1 from public.profiles p where p.user_id = u.id)
      and (exists (select 1 from public.players pl where pl.user_id = u.id and not pl.is_bot)
           or exists (select 1 from public.daily_answers d where d.user_id = u.id))
  ), picked as (
    select * from people a
    where (coalesce(p_query, '') = '' or a.name ilike v_pattern)
      and (coalesce(p_filter, 'all') = 'all'
           or (p_filter = 'accounts' and a.kind = 'account')
           or (p_filter = 'guests' and a.kind = 'guest')
           or (p_filter = 'new' and a.created_at >= v_week)
           or (p_filter = 'active' and a.last_seen >= v_week))
  )
  select (select count(*) from picked),
         coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc, r.user_id), '[]'::jsonb)
  into v_total, v_rows
  from (
    select a.user_id as "userId", a.kind, a.name as username, a.created_at as "createdAt",
           a.last_seen as "lastSeen",
           coalesce(st.games, 0) as games, coalesce(st.wins, 0) as wins, coalesce(st.points, 0) as points,
           (select count(*)::int from public.crew_members m where m.user_id = a.user_id) as crews,
           a.created_at, a.user_id
    from picked a
    left join public.player_stats st on st.user_id = a.user_id
    order by a.created_at desc, a.user_id
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  ) r;
  return jsonb_build_object(
    'total', v_total,
    'rows', (select coalesce(jsonb_agg(e - 'created_at' - 'user_id'), '[]'::jsonb) from jsonb_array_elements(v_rows) e)
  );
end;
$$;
revoke execute on function public.admin_accounts(text, text, int, int) from public, anon, authenticated;
grant execute on function public.admin_accounts(text, text, int, int) to service_role;

create or replace function public.admin_user_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with guests as (
    select u.id, u.created_at from auth.users u
    where u.is_anonymous
      and not exists (select 1 from public.profiles p where p.user_id = u.id)
      and (exists (select 1 from public.players pl where pl.user_id = u.id and not pl.is_bot)
           or exists (select 1 from public.daily_answers d where d.user_id = u.id))
  )
  select jsonb_build_object(
    'accounts', (select count(*) from public.profiles),
    'newAccounts', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'activeAccounts', (
      select count(*) from public.profiles p join auth.users u on u.id = p.user_id
      where greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = p.user_id))
        >= now() - interval '7 days'
    ),
    'guests', (select count(*) from guests),
    'newGuests', (select count(*) from guests where created_at >= now() - interval '7 days'),
    'visitors', (select count(*) from auth.users where is_anonymous)
  );
$$;
revoke execute on function public.admin_user_summary() from public, anon, authenticated;
grant execute on function public.admin_user_summary() to service_role;
