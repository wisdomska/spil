-- Reverses 20261024003000_custom_packs.sql. Afterwards run
--   supabase migration repair --status reverted 20261024003000
-- Deletes every custom pack (and its questions); rooms playing one go back to Classic.

update public.rooms r set pack_id = 'classic' from public.packs p where p.id = r.pack_id and p.room_id is not null;
delete from public.packs where room_id is not null;
alter table public.packs drop column if exists room_id;

-- start_round as it was in 20261024001000.
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

