-- Admin console, users and players (owner request 2026-11-12): bans, a detail view of one person,
-- sortable lists, signing a person out everywhere, and two new settings: a notice banner shown to
-- players and switching single games off.
-- Rollback: supabase/rollbacks/20261113000100_admin_user_ops.down.sql

-- ---------------------------------------------------------------------------------------------
-- Bans. One row per banned person; no row means not banned. expires_at null means until lifted.
-- Only the server (service role) reads or writes it.
-- ---------------------------------------------------------------------------------------------
create table public.user_bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  banned_by uuid references auth.users (id) on delete set null,
  banned_by_name text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.user_bans enable row level security;
revoke all on public.user_bans from anon, authenticated;
comment on table public.user_bans is 'Banned players. Server only (no RLS policies on purpose).';

-- ---------------------------------------------------------------------------------------------
-- Settings: a notice banner for players, and games switched off.
-- ---------------------------------------------------------------------------------------------
alter table public.settings
  add column notice text not null default '' check (char_length(notice) <= 200),
  add column notice_on boolean not null default false,
  add column disabled_modes text[] not null default '{}';

-- ---------------------------------------------------------------------------------------------
-- The user list gains a sort, a Banned filter and each person's ban.
-- ---------------------------------------------------------------------------------------------
drop function if exists public.admin_accounts(text, text, int, int);

create function public.admin_accounts(
  p_query text, p_filter text, p_limit int, p_offset int, p_sort text default 'joined_desc'
)
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
    select p.user_id, 'account'::text as kind, p.username as name, p.created_at,
           greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = p.user_id),
                    (select max(pl.last_seen_at) from public.players pl where pl.user_id = p.user_id)) as last_seen
    from public.profiles p
    join auth.users u on u.id = p.user_id
    union all
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
  ), banned as (
    select b.user_id, b.reason, b.expires_at from public.user_bans b
    where b.expires_at is null or b.expires_at > now()
  ), picked as (
    select a.*, coalesce(st.games, 0) as games, coalesce(st.wins, 0) as wins,
           coalesce(st.points, 0) as points, b.user_id is not null as is_banned,
           b.reason as ban_reason, b.expires_at as ban_until
    from people a
    left join public.player_stats st on st.user_id = a.user_id
    left join banned b on b.user_id = a.user_id
    where (coalesce(p_query, '') = '' or a.name ilike v_pattern)
      and (coalesce(p_filter, 'all') = 'all'
           or (p_filter = 'accounts' and a.kind = 'account')
           or (p_filter = 'guests' and a.kind = 'guest')
           or (p_filter = 'new' and a.created_at >= v_week)
           or (p_filter = 'active' and a.last_seen >= v_week)
           or (p_filter = 'banned' and b.user_id is not null))
  ), ordered as (
    select a.*, row_number() over (
      order by
        case when p_sort = 'joined_asc' then a.created_at end asc,
        case when p_sort = 'seen_desc' then a.last_seen end desc nulls last,
        case when p_sort = 'seen_asc' then a.last_seen end asc nulls first,
        case when p_sort = 'games_desc' then a.games end desc,
        case when p_sort = 'games_asc' then a.games end asc,
        case when p_sort = 'points_desc' then a.points end desc,
        case when p_sort = 'points_asc' then a.points end asc,
        case when p_sort = 'name_asc' then lower(a.name) end asc nulls last,
        case when p_sort = 'name_desc' then lower(a.name) end desc nulls last,
        a.created_at desc, a.user_id
    ) as n
    from picked a
  )
  select (select count(*) from picked),
         coalesce(jsonb_agg(row_to_json(r) order by r.n), '[]'::jsonb)
  into v_total, v_rows
  from (
    select a.user_id as "userId", a.kind, a.name as username, a.created_at as "createdAt",
           a.last_seen as "lastSeen", a.games, a.wins, a.points,
           (select count(*)::int from public.crew_members m where m.user_id = a.user_id) as crews,
           a.is_banned as banned, a.ban_until as "bannedUntil", a.n
    from ordered a
    where a.n > greatest(p_offset, 0) and a.n <= greatest(p_offset, 0) + greatest(p_limit, 1)
  ) r;
  return jsonb_build_object(
    'total', v_total,
    'rows', (select coalesce(jsonb_agg(e - 'n' order by (e ->> 'n')::int), '[]'::jsonb) from jsonb_array_elements(v_rows) e)
  );
end;
$$;
revoke execute on function public.admin_accounts(text, text, int, int, text) from public, anon, authenticated;
grant execute on function public.admin_accounts(text, text, int, int, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- One person, everything an admin needs to decide what to do. Never an email or an answer.
-- ---------------------------------------------------------------------------------------------
create function public.admin_user_detail(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when u.id is null then null else jsonb_build_object(
    'userId', u.id,
    'kind', case when p.user_id is not null then 'account' else 'guest' end,
    'username', coalesce(p.username, (
      select pl.nickname from public.players pl where pl.user_id = u.id and not pl.is_bot
      order by pl.joined_at desc limit 1)),
    'createdAt', u.created_at,
    'lastSeen', greatest(u.last_sign_in_at,
      (select max(s.updated_at) from auth.sessions s where s.user_id = u.id),
      (select max(pl.last_seen_at) from public.players pl where pl.user_id = u.id),
      (select max(d.created_at) from public.daily_answers d where d.user_id = u.id)),
    'sessions', (select count(*)::int from auth.sessions s where s.user_id = u.id),
    'ageBand', (select pl.age_band from public.players pl where pl.user_id = u.id
                order by pl.joined_at desc limit 1),
    'stats', (select jsonb_build_object('games', st.games, 'wins', st.wins, 'points', st.points,
                'hosted', st.hosted, 'bullseyes', st.bullseyes, 'modes', st.modes)
              from public.player_stats st where st.user_id = u.id),
    'dailyAnswers', (select count(*)::int from public.daily_answers d where d.user_id = u.id),
    'nicknames', coalesce((
      select jsonb_agg(x.nickname order by x.last desc) from (
        select pl.nickname, max(pl.joined_at) as last from public.players pl
        where pl.user_id = u.id and not pl.is_bot group by pl.nickname
        order by last desc limit 10) x), '[]'::jsonb),
    'rooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'roomId', r.id, 'code', r.code, 'mode', r.mode, 'status', r.status,
        'playerId', pl.id, 'playerStatus', pl.status, 'nickname', pl.nickname,
        'isHost', r.host_player_id = pl.id, 'joinedAt', pl.joined_at) order by pl.joined_at desc)
      from (select * from public.players where user_id = u.id and not is_bot
            order by joined_at desc limit 20) pl
      join public.rooms r on r.id = pl.room_id), '[]'::jsonb),
    'liveRooms', (select count(*)::int from public.players pl join public.rooms r on r.id = pl.room_id
                  where pl.user_id = u.id and pl.status = 'active' and r.status <> 'closed'),
    'crews', coalesce((
      select jsonb_agg(jsonb_build_object('crewId', c.id, 'name', c.name, 'nickname', m.nickname)
                       order by m.joined_at desc)
      from public.crew_members m join public.crews c on c.id = m.crew_id where m.user_id = u.id), '[]'::jsonb),
    'reportsAgainst', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'reason', x.reason, 'status', x.status,
                                          'createdAt', x.created_at) order by x.created_at desc)
      from (select rp.* from public.reports rp join public.players pl on pl.id = rp.player_id
            where pl.user_id = u.id order by rp.created_at desc limit 10) x), '[]'::jsonb),
    'reportsAgainstTotal', (select count(*)::int from public.reports rp join public.players pl on pl.id = rp.player_id
                            where pl.user_id = u.id),
    'reportsBy', (select count(*)::int from public.reports rp where rp.reporter_user_id = u.id),
    'ban', (select jsonb_build_object('reason', b.reason, 'by', b.banned_by_name,
                                      'at', b.created_at, 'until', b.expires_at)
            from public.user_bans b where b.user_id = u.id
              and (b.expires_at is null or b.expires_at > now()))
  ) end
  from (select 1) one
  left join auth.users u on u.id = p_user
  left join public.profiles p on p.user_id = u.id;
$$;
revoke execute on function public.admin_user_detail(uuid) from public, anon, authenticated;
grant execute on function public.admin_user_detail(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Sign a person out on every phone: their sessions and refresh tokens go. A guest who is signed
-- out loses that guest identity for good (there is no password to come back with).
-- ---------------------------------------------------------------------------------------------
create function public.admin_revoke_sessions(p_user uuid)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.admin_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_sessions(uuid) to service_role;

-- The summary counts banned people too.
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
    'visitors', (select count(*) from auth.users where is_anonymous),
    'banned', (select count(*) from public.user_bans where expires_at is null or expires_at > now()),
    'playingNow', (select count(distinct pl.user_id) from public.players pl join public.rooms r on r.id = pl.room_id
                   where pl.status = 'active' and not pl.is_bot and r.status <> 'closed'
                     and pl.last_seen_at >= now() - interval '5 minutes')
  );
$$;
