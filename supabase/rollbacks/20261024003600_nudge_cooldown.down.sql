-- Reverses 20261024003600_nudge_cooldown.sql: the nudge function without the cooldown, and the
-- column dropped. Afterwards run
--   supabase migration repair --status reverted 20261024003600
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

  perform realtime.send(
    jsonb_build_object('roomId', p_room, 'targetPlayerId', p_target, 'at', now()),
    'nudge',
    'room:' || p_room::text,
    true
  );
end;
$$;
alter table public.players drop column if exists nudged_at;
