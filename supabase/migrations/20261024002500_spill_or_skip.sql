-- Spill or Skip (Batch 1, game mode 9): a classic round, then on the results the room votes for
-- one yes it wants the story behind (only Spill Mode players can be picked; anyone can skip). The
-- votes are mode inputs of kind pick (one per player, already replaced on save), so the only new
-- piece is a way for the API to tell every phone in the room to refresh after a vote.
-- Rollback: supabase/rollbacks/20261024002500_spill_or_skip.down.sql

create function public.notify_room(p_room uuid, p_event text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('roomId', p_room, 'at', now()),
    p_event,
    'room:' || p_room::text,
    true
  );
end;
$$;

revoke execute on function public.notify_room(uuid, text) from public, anon, authenticated;
grant execute on function public.notify_room(uuid, text) to service_role;
