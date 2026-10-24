-- SPIL-03: live answer progress. Each player's answered count and last answer time are kept on
-- the player row, updated in the same transaction as the answers, and broadcast to the room as a
-- small "progress" event so other phones patch their view without refetching.
-- Rollback: supabase/rollbacks/20261024000900_answer_progress.down.sql

alter table public.players
  add column answered_count int not null default 0 check (answered_count >= 0),
  add column last_answer_at timestamptz;

-- Saves a batch of answers (last write wins per question), updates the player's count for the
-- round and broadcasts {playerId, answered, at}. Returns the count. Service role only; the API
-- has already checked membership, phase and that every question belongs to the round.
--
-- p_answers: [{question_id, value}]
create function public.save_answers(p_player uuid, p_room uuid, p_round int, p_answers jsonb)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_at timestamptz := now();
begin
  insert into public.answers (player_id, room_id, round, question_id, value)
  select p_player, p_room, p_round, (a ->> 'question_id')::uuid, (a ->> 'value')::public.answer_value
  from jsonb_array_elements(p_answers) a
  on conflict (player_id, round, question_id) do update set value = excluded.value;

  select count(*) into v_count
  from public.answers
  where player_id = p_player and round = p_round;

  update public.players
  set answered_count = v_count, last_answer_at = v_at
  where id = p_player;

  perform realtime.send(
    jsonb_build_object('playerId', p_player, 'answered', v_count, 'round', p_round, 'at', v_at),
    'progress',
    'room:' || p_room::text,
    true
  );
  return v_count;
end;
$$;

revoke execute on function public.save_answers(uuid, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.save_answers(uuid, uuid, int, jsonb) to service_role;
