-- Crews and seasons (Batch 3): a saved group of friends, no signup (device session plus an invite
-- link). Members join by choice. Each round played as the crew keeps only nicknames, Mind Reader
-- points and ranks (never answers or Spill Scores), in its own table so it outlives the room
-- (rooms are deleted after 7 days). Only members can read a crew; the API writes.
-- Rollback: supabase/rollbacks/20261024002900_crews.down.sql

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_token text not null unique check (char_length(invite_token) between 16 and 64),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index crew_members_user_idx on public.crew_members (user_id);

create table public.crew_rounds (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  room_code text not null,
  round int not null check (round >= 1),
  mode text not null,
  played_at timestamptz not null default now(),
  -- [{user_id, nickname, points, rank}] for members who played; nothing else.
  scores jsonb not null default '[]'::jsonb,
  unique (crew_id, room_code, round)
);
create index crew_rounds_crew_played_idx on public.crew_rounds (crew_id, played_at desc);

alter table public.rooms add column crew_id uuid references public.crews (id) on delete set null;

-- Membership check for the policies (security definer, so the policy does not recurse).
create function public.is_crew_member(p_crew uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crew_members m where m.crew_id = p_crew and m.user_id = auth.uid()
  );
$$;
revoke execute on function public.is_crew_member(uuid) from public, anon;
grant execute on function public.is_crew_member(uuid) to authenticated, service_role;

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_rounds enable row level security;
create policy crews_select_member on public.crews
  for select to authenticated using (public.is_crew_member(id));
create policy crew_members_select_member on public.crew_members
  for select to authenticated using (public.is_crew_member(crew_id));
create policy crew_rounds_select_member on public.crew_rounds
  for select to authenticated using (public.is_crew_member(crew_id));
revoke all on public.crews, public.crew_members, public.crew_rounds from anon, authenticated;
grant select on public.crews, public.crew_members, public.crew_rounds to authenticated;
