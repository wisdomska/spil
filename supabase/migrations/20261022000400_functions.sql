-- Helper and game functions. See docs/TECH_SPEC.md sections 9, 13.5 and 18.
--
-- Every function is security definer with an empty search_path and fully
-- qualified names. RLS helpers are callable by anon and authenticated (they
-- only answer questions about the caller). Game and ops functions are for the
-- service role only: execute is revoked from public, anon and authenticated.
--
-- Errors are raised with the API error code as the message (e.g. WRONG_PHASE)
-- so route handlers can map them directly.

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

-- True when the caller has a player in the room that is still in the game
-- (active, or sat_out after a force-advance; not left or removed).
create function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.players p
    where p.room_id = p_room
      and p.user_id = (select auth.uid())
      and p.status in ('active', 'sat_out')
  );
$$;

-- True when the caller is an admin, optionally restricted to the given roles.
create function public.is_admin(p_roles public.admin_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins a
    where a.user_id = (select auth.uid())
      and (p_roles is null or a.role = any (p_roles))
  );
$$;

-- Player ids that belong to the caller, across rooms.
create function public.current_player_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.players p
  where p.user_id = (select auth.uid());
$$;

-- True when the caller is a member of the room and the room is revealed.
create function public.is_room_revealed(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_room_member(p_room)
     and exists (
       select 1 from public.rooms r
       where r.id = p_room and r.status = 'revealed'
     );
$$;

-- True when the realtime topic is 'room:{uuid}' and the caller is a member.
create function public.can_access_room_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_topic is null
     or p_topic !~ '^room:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  return public.is_room_member(substr(p_topic, 6)::uuid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window)
-- ---------------------------------------------------------------------------

-- Counts one hit for p_key in the current window and returns true while the
-- count is within p_limit.
create function public.check_rate_limit(p_key text, p_limit int, p_window interval)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_secs double precision;
  v_start timestamptz;
  v_count int;
begin
  v_secs := extract(epoch from p_window);
  if p_key is null or p_limit is null or v_secs is null or v_secs <= 0 then
    raise exception 'INVALID_RATE_LIMIT' using errcode = '22023';
  end if;

  v_start := to_timestamp(floor(extract(epoch from now()) / v_secs) * v_secs);

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set count = rl.count + 1
  returning rl.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention (Vercel cron, daily)
-- ---------------------------------------------------------------------------

create function public.expire_rooms()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_closed int;
  v_deleted int;
  v_users int;
begin
  -- Lobbies nobody started within 24 hours are closed.
  update public.rooms
  set status = 'closed'
  where status = 'lobby'
    and created_at < now() - interval '24 hours';
  get diagnostics v_closed = row_count;

  -- All room data is hard-deleted 7 days after creation (cascades).
  delete from public.rooms
  where expires_at < now();
  get diagnostics v_deleted = row_count;

  -- Anonymous users with no players left and no sign-in for 30 days.
  delete from auth.users u
  where u.is_anonymous
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
    and not exists (select 1 from public.players p where p.user_id = u.id);
  get diagnostics v_users = row_count;

  -- Old rate limit windows.
  delete from public.rate_limits
  where window_start < now() - interval '1 day';

  return jsonb_build_object('closed', v_closed, 'deleted', v_deleted, 'users_deleted', v_users);
end;
$$;

-- ---------------------------------------------------------------------------
-- Phase changes
-- ---------------------------------------------------------------------------

-- Moves a room from p_from to p_to under a row lock. A second caller that
-- lost the race sees the new status and gets WRONG_PHASE.
create function public.advance_room(p_room uuid, p_from public.room_status, p_to public.room_status)
returns public.rooms
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  select * into v_room
  from public.rooms
  where id = p_room
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_room.status <> p_from then
    raise exception 'WRONG_PHASE'
      using errcode = 'P0001',
            detail = format('room is %s, expected %s', v_room.status, p_from);
  end if;

  if not (
       (p_from = 'lobby' and p_to = 'answering')
    or (p_from = 'answering' and p_to = 'guessing')
    or (p_from = 'guessing' and p_to = 'ready')
    or (p_from = 'ready' and p_to = 'revealed')
    or (p_from = 'revealed' and p_to = 'lobby')
    or (p_from <> 'closed' and p_to = 'closed')
  ) then
    raise exception 'INVALID_TRANSITION'
      using errcode = 'P0001',
            detail = format('%s to %s is not allowed', p_from, p_to);
  end if;

  update public.rooms r
  set status = p_to,
      started_at = case when p_to = 'answering' then now() else r.started_at end,
      guessing_at = case when p_to = 'guessing' then now() else r.guessing_at end,
      ready_at = case when p_to = 'ready' then now() else r.ready_at end,
      revealed_at = case when p_to = 'revealed' then now() else r.revealed_at end
  where r.id = p_room
  returning * into v_room;

  return v_room;
end;
$$;

-- Stores computed results and awards for a round, once. A repeated call for a
-- round that is already final is a no-op.
--
-- p_results: [{player_id, spill_score, label, avg_guess_about, mind_reader, rank}]
-- p_awards:  [{award, player_id, reason, position}]
create function public.save_results(p_room uuid, p_round int, p_results jsonb, p_awards jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  select * into v_room
  from public.rooms
  where id = p_room
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_room.final_round >= p_round then
    return;
  end if;

  if v_room.status <> 'ready' or v_room.round <> p_round then
    raise exception 'WRONG_PHASE'
      using errcode = 'P0001',
            detail = format('room is %s in round %s', v_room.status, v_room.round);
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as x (player_id uuid)
    where not exists (
      select 1 from public.players p where p.id = x.player_id and p.room_id = p_room
    )
  ) or exists (
    select 1
    from jsonb_to_recordset(coalesce(p_awards, '[]'::jsonb)) as x (player_id uuid)
    where not exists (
      select 1 from public.players p where p.id = x.player_id and p.room_id = p_room
    )
  ) then
    raise exception 'INVALID_PLAYER' using errcode = '22023';
  end if;

  insert into public.results (room_id, round, player_id, spill_score, label, avg_guess_about, mind_reader, rank)
  select p_room, p_round, x.player_id, x.spill_score, x.label, x.avg_guess_about, x.mind_reader, x.rank
  from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb)) as x (
    player_id uuid,
    spill_score smallint,
    label text,
    avg_guess_about smallint,
    mind_reader smallint,
    rank smallint
  );

  insert into public.awards (room_id, round, award, player_id, reason, position)
  select p_room, p_round, x.award, x.player_id, x.reason, x.position
  from jsonb_to_recordset(coalesce(p_awards, '[]'::jsonb)) as x (
    award text,
    player_id uuid,
    reason text,
    position smallint
  );

  -- Global answer stats. Skips are not answers; test players never count.
  update public.questions q
  set yes_count = q.yes_count + s.yes_n,
      answered_count = q.answered_count + s.answered_n
  from (
    select a.question_id,
           count(*) filter (where a.value = 'yes') as yes_n,
           count(*) filter (where a.value in ('yes', 'no')) as answered_n
    from public.answers a
    join public.players p on p.id = a.player_id
    where a.room_id = p_room
      and a.round = p_round
      and p.status in ('active', 'sat_out')
      and not p.is_bot
    group by a.question_id
  ) s
  where q.id = s.question_id;

  insert into public.stats_daily as sd (day, games_finished)
  values ((now() at time zone 'utc')::date, 1)
  on conflict (day) do update set games_finished = sd.games_finished + 1;

  update public.rooms
  set final_round = p_round,
      status = 'revealed',
      revealed_at = now()
  where id = p_room;
end;
$$;

-- Starts a round: clears answers and guesses, resets per-round player state,
-- draws p_n random live questions and moves the room to answering.
-- The round number goes up only when the current round is already final, so
-- the first start (and a start after a rematch that already bumped the round)
-- keeps it. For an adult pack the room stays in lobby until every active
-- player has confirmed 18+; switching to a new adult pack clears all
-- confirmations first.
create function public.start_round(p_room uuid, p_pack text, p_n int)
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
      status = case when status = 'sat_out' then 'active'::public.player_status else status end,
      age_confirmed = case when v_pack.is_adult and v_pack.id <> v_room.pack_id then false else age_confirmed end
  where room_id = p_room;

  if v_pack.is_adult and exists (
    select 1 from public.players p
    where p.room_id = p_room and p.status = 'active' and not p.age_confirmed
  ) then
    update public.rooms
    set pack_id = p_pack,
        round = v_round,
        status = 'lobby'
    where id = p_room;
    return;
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

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Host nudge: broadcasts to the room channel; the target device shakes.
create function public.nudge(p_room uuid, p_target uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.players p
    where p.id = p_target and p.room_id = p_room and p.status in ('active', 'sat_out')
  ) then
    raise exception 'PLAYER_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform realtime.send(
    jsonb_build_object('roomId', p_room, 'targetPlayerId', p_target, 'at', now()),
    'nudge',
    'room:' || p_room::text,
    true
  );
end;
$$;

create function public.broadcast_room_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'roomId', new.id,
      'status', new.status,
      'round', new.round,
      'hostPlayerId', new.host_player_id,
      'revealed_at', new.revealed_at,
      'at', now()
    ),
    case when new.status = 'closed' then 'room_closed' else 'room_changed' end,
    'room:' || new.id::text,
    true
  );
  return null;
end;
$$;

create function public.broadcast_player_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_player_id uuid;
  v_status public.player_status;
begin
  if tg_op = 'DELETE' then
    v_room_id := old.room_id;
    v_player_id := old.id;
    v_status := old.status;
    -- Skip when the whole room is being deleted (retention cascade).
    if not exists (select 1 from public.rooms r where r.id = v_room_id) then
      return null;
    end if;
  else
    v_room_id := new.room_id;
    v_player_id := new.id;
    v_status := new.status;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'roomId', v_room_id,
      'playerId', v_player_id,
      'status', v_status,
      'op', lower(tg_op),
      'at', now()
    ),
    'player_changed',
    'room:' || v_room_id::text,
    true
  );
  return null;
end;
$$;

create trigger rooms_broadcast_change
  after update of status, round, host_player_id on public.rooms
  for each row
  when (
    old.status is distinct from new.status
    or old.round is distinct from new.round
    or old.host_player_id is distinct from new.host_player_id
  )
  execute function public.broadcast_room_change();

create trigger players_broadcast_insert_delete
  after insert or delete on public.players
  for each row
  execute function public.broadcast_player_change();

create trigger players_broadcast_update
  after update of status, answers_submitted_at, guesses_submitted_at, spill_mode, nickname, avatar on public.players
  for each row
  when (
    old.status is distinct from new.status
    or old.answers_submitted_at is distinct from new.answers_submitted_at
    or old.guesses_submitted_at is distinct from new.guesses_submitted_at
    or old.spill_mode is distinct from new.spill_mode
    or old.nickname is distinct from new.nickname
    or old.avatar is distinct from new.avatar
  )
  execute function public.broadcast_player_change();

-- ---------------------------------------------------------------------------
-- Admin guard: a moderator may only hide a question, nothing else.
-- ---------------------------------------------------------------------------

create function public.guard_question_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and not public.is_admin(array['owner', 'content_lead']::public.admin_role[]) then
    if new.id is distinct from old.id
       or new.pack_id is distinct from old.pack_id
       or new.text is distinct from old.text
       or new.yes_count is distinct from old.yes_count
       or new.answered_count is distinct from old.answered_count
       or new.report_count is distinct from old.report_count
       or new.status <> 'hidden' then
      raise exception 'FORBIDDEN' using errcode = '42501', detail = 'moderators may only hide questions';
    end if;
  end if;
  return new;
end;
$$;

create trigger questions_guard_update
  before update on public.questions
  for each row
  execute function public.guard_question_update();

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

-- RLS helpers: used inside policies, safe for any caller.
revoke execute on function public.is_room_member(uuid) from public;
revoke execute on function public.is_admin(public.admin_role[]) from public;
revoke execute on function public.current_player_ids() from public;
revoke execute on function public.is_room_revealed(uuid) from public;
revoke execute on function public.can_access_room_topic(text) from public;
grant execute on function public.is_room_member(uuid) to anon, authenticated, service_role;
grant execute on function public.is_admin(public.admin_role[]) to anon, authenticated, service_role;
grant execute on function public.current_player_ids() to anon, authenticated, service_role;
grant execute on function public.is_room_revealed(uuid) to anon, authenticated, service_role;
grant execute on function public.can_access_room_topic(text) to anon, authenticated, service_role;

-- Service role only.
revoke execute on function public.check_rate_limit(text, int, interval) from public, anon, authenticated;
revoke execute on function public.expire_rooms() from public, anon, authenticated;
revoke execute on function public.advance_room(uuid, public.room_status, public.room_status) from public, anon, authenticated;
revoke execute on function public.save_results(uuid, int, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.start_round(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.nudge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, interval) to service_role;
grant execute on function public.expire_rooms() to service_role;
grant execute on function public.advance_room(uuid, public.room_status, public.room_status) to service_role;
grant execute on function public.save_results(uuid, int, jsonb, jsonb) to service_role;
grant execute on function public.start_round(uuid, text, int) to service_role;
grant execute on function public.nudge(uuid, uuid) to service_role;

-- Trigger functions are never called directly.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.broadcast_room_change() from public, anon, authenticated;
revoke execute on function public.broadcast_player_change() from public, anon, authenticated;
revoke execute on function public.guard_question_update() from public, anon, authenticated;
