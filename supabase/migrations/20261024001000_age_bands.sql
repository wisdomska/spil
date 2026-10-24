-- SPIL-02: age bands instead of the per-player 18+ tick. Players give their age on their own
-- device; only the band (13_15, 16_17, 18_plus) ever reaches the server. Packs carry a minimum
-- age (13, 16 or 18) and rooms cache the minimum age of their pack.
-- Rollback: supabase/rollbacks/20261024001000_age_bands.down.sql
--
-- Kept, no longer used: players.age_confirmed and packs.heat (removing them is a follow-up, so no
-- data is deleted here). packs.is_adult stays in step with min_age = 18.

create type public.age_band as enum ('13_15', '16_17', '18_plus');

create function public.band_floor(b public.age_band)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select (case b when '13_15' then 13 when '16_17' then 16 else 18 end)::smallint
$$;

alter table public.packs
  add column min_age smallint not null default 13 check (min_age in (13, 16, 18));
update public.packs set min_age = 18 where is_adult;

-- Default 13_15 is the safe fallback. Players who already confirmed 18+ (and test players) keep
-- adult access so lobbies open at release time still start.
alter table public.players
  add column age_band public.age_band not null default '13_15';
update public.players set age_band = '18_plus' where age_confirmed or is_bot;

alter table public.rooms
  add column min_age smallint not null default 13 check (min_age in (13, 16, 18));
update public.rooms r set min_age = p.min_age from public.packs p where p.id = r.pack_id;

-- Admin setting: how long a minor's age stays locked on the device (hours).
alter table public.settings
  add column age_lock_hours int not null default 24 check (age_lock_hours between 1 and 168);

-- Clients never read or write age_band: players has column-level select grants that do not
-- include it, and no insert or update grants. Bands are written by the API (service role).

create or replace function public.start_round(p_room uuid, p_pack text, p_n int)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_pack public.packs;
  v_round int;
  v_drawn int;
  v_day date := (now() at time zone 'utc')::date;
begin
  select * into v_room
  from public.rooms
  where id = p_room
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_room.status not in ('lobby', 'revealed') then
    raise exception 'WRONG_PHASE'
      using errcode = 'P0001',
            detail = format('room is %s', v_room.status);
  end if;

  if p_n is null or p_n < 1 then
    raise exception 'INVALID_COUNT' using errcode = '22023';
  end if;

  select * into v_pack
  from public.packs
  where id = p_pack;

  if not found or v_pack.status <> 'live' then
    raise exception 'PACK_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_round := case when v_room.final_round >= v_room.round then v_room.round + 1 else v_room.round end;

  delete from public.answers where room_id = p_room;
  delete from public.guesses where room_id = p_room;
  delete from public.room_questions where room_id = p_room and round = v_round;

  update public.players
  set answers_submitted_at = null,
      guesses_submitted_at = null,
      spill_mode = false,
      status = case when status = 'sat_out' then 'active'::public.player_status else status end
  where room_id = p_room;

  -- SPIL-02: every active player's age band must reach the pack's minimum age.
  if exists (
    select 1 from public.players p
    where p.room_id = p_room and p.status = 'active'
      and public.band_floor(p.age_band) < v_pack.min_age
  ) then
    raise exception 'PACK_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  insert into public.room_questions (room_id, round, position, question_id)
  select p_room, v_round, row_number() over (), d.id
  from (
    select q.id
    from public.questions q
    where q.pack_id = p_pack and q.status = 'live'
    order by random()
    limit p_n
  ) d;
  get diagnostics v_drawn = row_count;

  if v_drawn = 0 then
    raise exception 'PACK_UNAVAILABLE' using errcode = 'P0001', detail = 'pack has no live questions';
  end if;

  update public.rooms
  set pack_id = p_pack,
      round = v_round,
      status = 'answering',
      started_at = now(),
      guessing_at = null,
      ready_at = null,
      revealed_at = null
  where id = p_room;

  insert into public.stats_daily as sd (day, games_started)
  values (v_day, 1)
  on conflict (day) do update set games_started = sd.games_started + 1;

  insert into public.pack_plays as pp (pack_id, day, started)
  values (p_pack, v_day, 1)
  on conflict (pack_id, day) do update set started = pp.started + 1;
end;
$$;
