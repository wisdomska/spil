-- Admin console, Users (owner request 2026-11-05): accounts with their stats and when they were
-- last seen, plus a summary that also counts guest players. Last seen is the latest of the last
-- sign-in and the last session refresh, so a player who stays signed in still shows as active.
-- auth.users is not reachable through the API, hence these functions; service_role only, read
-- only, and they never return an email address.
-- Rollback: supabase/rollbacks/20261105000100_admin_users.down.sql

create function public.admin_accounts(p_query text, p_filter text, p_limit int, p_offset int)
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
  with accounts as (
    select p.user_id, p.username, p.created_at,
           greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = p.user_id)) as last_seen
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.username ilike v_pattern
  ), picked as (
    select * from accounts a
    where coalesce(p_filter, 'all') = 'all'
       or (p_filter = 'new' and a.created_at >= v_week)
       or (p_filter = 'active' and a.last_seen >= v_week)
  )
  select (select count(*) from picked),
         coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc, r.user_id), '[]'::jsonb)
  into v_total, v_rows
  from (
    select a.user_id as "userId", a.username, a.created_at as "createdAt", a.last_seen as "lastSeen",
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

create function public.admin_user_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'accounts', (select count(*) from public.profiles),
    'newAccounts', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'activeAccounts', (
      select count(*) from public.profiles p join auth.users u on u.id = p.user_id
      where greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = p.user_id))
        >= now() - interval '7 days'
    ),
    'guests', (select count(*) from auth.users where is_anonymous),
    'newGuests', (select count(*) from auth.users where is_anonymous and created_at >= now() - interval '7 days')
  );
$$;
revoke execute on function public.admin_user_summary() from public, anon, authenticated;
grant execute on function public.admin_user_summary() to service_role;
