-- Editions (owner request 2026-11-24): a few questions only land with people from one place
-- (trotro, owambe, hall week, shito). Each question may carry a region; a room plays one edition.
--   questions.region: null = everyone, 'GH' = Ghana, 'NG' = Nigeria, 'WA' = both (West Africa).
--   rooms.edition:    'global' plays only questions with no region; 'GH' adds GH and WA ones;
--                     'NG' adds NG and WA ones.
-- Packs that are local as a whole (packs.region, e.g. SHS Days) keep their questions untagged,
-- so every edition plays them in full.
-- Rollback: supabase/rollbacks/20261125000100_editions.down.sql

alter table public.questions
  add column region text check (region in ('GH', 'NG', 'WA'));
comment on column public.questions.region is
  'null = every edition; GH = Ghana; NG = Nigeria; WA = both Ghana and Nigeria editions.';

alter table public.rooms
  add column edition text not null default 'global' check (edition in ('global', 'GH', 'NG'));
comment on column public.rooms.edition is 'Which local questions this room plays (see questions.region).';

-- The audit of the live bank (2026-11-24): the questions that need local knowledge.
update public.questions q
set region = v.region
from (values
  ('afterdark', 'kissed someone you barely knew during Detty December?', 'WA'),
  ('campus', 'bought a lecturer''s handout only because it might be on the exam?', 'WA'),
  ('campus', 'hidden a squatter from the porter during room inspection?', 'WA'),
  ('campus', 'gone to a hall week party the night before a paper?', 'GH'),
  ('campus', 'survived on gari and groundnuts for a whole week?', 'WA'),
  ('church_kid', 'danced harder than everyone at thanksgiving?', 'WA'),
  ('church_kid', 'joined an all-night service and slept through most of it?', 'WA'),
  ('classic', 'dodged paying your full trotro or danfo fare?', 'WA'),
  ('classic', 'eaten the meat from the stew pot before dinner was served?', 'WA'),
  ('detty_december', 'danced at an owambe until your feet hurt?', 'NG'),
  ('detty_december', 'eaten jollof at four different places in one week?', 'WA'),
  ('exam_season', 'forgotten your index number in the exam hall?', 'WA'),
  ('hot_takes', 'Jollof tastes better the next day.', 'WA'),
  ('hot_takes', 'Ketchup on jollof is a crime.', 'WA'),
  ('imposter', 'How much do you like jollof?', 'WA'),
  ('roadtrip', 'packed shito or gari in your luggage for a trip abroad?', 'WA'),
  ('work', 'called in sick to go to a wedding or owambe?', 'NG')
) as v(pack_id, text, region)
where q.pack_id = v.pack_id and q.text = v.text;

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

  -- Live packs, or a room's own hidden custom pack (Batch 3); never another room's.
  if not found or (
    v_pack.status <> 'live' and not (v_pack.status = 'hidden' and v_pack.room_id = p_room)
  ) then
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

  -- The room's edition: questions for everyone, plus the local ones it plays.
  insert into public.room_questions (room_id, round, position, question_id)
  select p_room, v_round, row_number() over (), d.id
  from (
    select q.id
    from public.questions q
    where q.pack_id = p_pack and q.status = 'live'
      and (
        q.region is null
        or (v_room.edition = 'GH' and q.region in ('GH', 'WA'))
        or (v_room.edition = 'NG' and q.region in ('NG', 'WA'))
      )
    order by random()
    limit p_n
  ) d;
  get diagnostics v_drawn = row_count;

  -- A pack with nothing for this edition (every question local): play it as it is.
  if v_drawn = 0 then
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
  end if;

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
