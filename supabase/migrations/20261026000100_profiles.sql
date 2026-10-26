-- Optional accounts (owner decision 2026-10-26): a username and password saved onto the player's
-- existing anonymous user, so its id (and every badge, crew and daily answer) carries over. No
-- email: the auth user gets a hidden placeholder address, and a one-time recovery code (stored
-- only as a scrypt hash) is the way back in. Players read their own row; only the API writes.
-- Rollback: supabase/rollbacks/20261026000100_profiles.down.sql

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  recovery_hash text not null check (char_length(recovery_hash) between 32 and 300),
  created_at timestamptz not null default now()
);
-- Usernames are unique whatever their case.
create unique index profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = auth.uid());
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- Failed bot checks on the account endpoints show on the admin dashboard too.
alter table public.captcha_events drop constraint captcha_events_endpoint_check;
alter table public.captcha_events add constraint captcha_events_endpoint_check
  check (endpoint in ('create_room', 'contact', 'account'));

-- Second phone: adds a guest's progress to an account, then removes it from the guest. Stats add
-- up, crews and daily answers move over (a crew or day the account already has is kept as is),
-- and crews the guest started now belong to the account.
create function public.merge_guest_progress(p_from uuid, p_into uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_from = p_into then
    return;
  end if;

  insert into public.player_stats as s (user_id, games, wins, bullseyes, hosted, points, modes)
  select p_into, f.games, f.wins, f.bullseyes, f.hosted, f.points, f.modes
  from public.player_stats f
  where f.user_id = p_from
  on conflict (user_id) do update set
    games = s.games + excluded.games,
    wins = s.wins + excluded.wins,
    bullseyes = s.bullseyes + excluded.bullseyes,
    hosted = s.hosted + excluded.hosted,
    points = s.points + excluded.points,
    modes = (select coalesce(array_agg(distinct m), '{}') from unnest(s.modes || excluded.modes) m),
    updated_at = now();
  delete from public.player_stats where user_id = p_from;

  insert into public.crew_members (crew_id, user_id, nickname, joined_at)
  select crew_id, p_into, nickname, joined_at
  from public.crew_members
  where user_id = p_from
  on conflict (crew_id, user_id) do nothing;
  delete from public.crew_members where user_id = p_from;
  update public.crews set created_by = p_into where created_by = p_from;

  insert into public.daily_answers (day, user_id, question_id, value, created_at)
  select day, p_into, question_id, value, created_at
  from public.daily_answers
  where user_id = p_from
  on conflict (day, user_id) do nothing;
  delete from public.daily_answers where user_id = p_from;
end;
$$;
revoke execute on function public.merge_guest_progress(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest_progress(uuid, uuid) to service_role;

-- Delete account: the profile, stats, crew memberships and daily answers go. A crew the player
-- started passes to its longest-standing other member, or is deleted when nobody is left. The
-- API then deletes the auth user.
create function public.delete_account_data(p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.crew_members where user_id = p_user;
  update public.crews c set created_by = (
    select m.user_id from public.crew_members m
    where m.crew_id = c.id
    order by m.joined_at, m.user_id
    limit 1
  )
  where c.created_by = p_user
    and exists (select 1 from public.crew_members m where m.crew_id = c.id);
  delete from public.crews where created_by = p_user;
  delete from public.player_stats where user_id = p_user;
  delete from public.daily_answers where user_id = p_user;
  delete from public.profiles where user_id = p_user;
end;
$$;
revoke execute on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
