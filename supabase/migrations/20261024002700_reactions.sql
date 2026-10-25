-- Live reactions (Batch 2): during the reveal anyone in the room can send one of a few fixed emoji.
-- Broadcast on the room channel, never stored. The API checks membership and rate limits; this
-- function refuses anything outside the fixed list, so nothing else can be broadcast this way.
-- Rollback: supabase/rollbacks/20261024002700_reactions.down.sql

create function public.send_reaction(p_room uuid, p_player uuid, p_emoji text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_emoji not in ('😂', '😱', '🔥', '👀', '🫣', '💀') then
    raise exception 'unknown reaction' using errcode = '22023';
  end if;
  perform realtime.send(
    jsonb_build_object('playerId', p_player, 'emoji', p_emoji, 'at', now()),
    'reaction',
    'room:' || p_room::text,
    true
  );
end;
$$;

revoke execute on function public.send_reaction(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.send_reaction(uuid, uuid, text) to service_role;
