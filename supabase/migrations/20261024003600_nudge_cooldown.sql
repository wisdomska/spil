-- Nudge cooldown (SPIL-29): one nudge per target per 20 seconds, enforced where it is sent.
-- players.nudged_at holds the last nudge; the conditional update makes two quick nudges race
-- safely (only one passes). Clock-window rate limits could let two through across a boundary.
-- Rollback: supabase/rollbacks/20261024003600_nudge_cooldown.down.sql

alter table public.players add column nudged_at timestamptz;

create or replace function public.nudge(p_room uuid, p_target uuid)
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

  update public.players p
  set nudged_at = now()
  where p.id = p_target
    and p.room_id = p_room
    and (p.nudged_at is null or p.nudged_at <= now() - interval '20 seconds');
  if not found then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  perform realtime.send(
    jsonb_build_object('roomId', p_room, 'targetPlayerId', p_target, 'at', now()),
    'nudge',
    'room:' || p_room::text,
    true
  );
end;
$$;

revoke execute on function public.nudge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.nudge(uuid, uuid) to service_role;
