-- Two Truths and a Spill (Batch 1, game mode 7): yes or no answers, then each player picks a card
-- of two truths and a spill from their own answers (mode inputs of kind pick: value 1 for a
-- truth, 0 for the spill), and everyone spots the spill on each card (new kind spot: target is
-- the card owner, question is the spot). Plays the ordinary yes or no packs.
-- Rollback: supabase/rollbacks/20261024002300_two_truths.down.sql

alter table public.mode_inputs drop constraint if exists mode_inputs_kind_check;
alter table public.mode_inputs
  add constraint mode_inputs_kind_check
  check (kind in ('percent', 'rating', 'vote', 'rank', 'pick', 'text', 'spot'));

create or replace function public.save_mode_inputs(
  p_player uuid, p_room uuid, p_round int, p_kind text, p_inputs jsonb
)
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
  -- Two Truths: a new card replaces the whole old card; a spot replaces the old spot on that card.
  if p_kind = 'pick' then
    delete from public.mode_inputs m
    where m.player_id = p_player and m.round = p_round and m.kind = 'pick';
  end if;
  if p_kind = 'spot' then
    delete from public.mode_inputs m
    where m.player_id = p_player and m.round = p_round and m.kind = 'spot'
      and m.target_id in (
        select nullif(i ->> 'target_id', '')::uuid from jsonb_array_elements(p_inputs) i
      );
  end if;

  if p_kind in ('vote', 'rank') then
    delete from public.mode_inputs m
    where m.player_id = p_player and m.round = p_round and m.kind = p_kind
      and exists (
        select 1 from jsonb_array_elements(p_inputs) i
        where nullif(i ->> 'question_id', '')::uuid is not distinct from m.question_id
      );
  end if;

  insert into public.mode_inputs (room_id, round, player_id, kind, question_id, target_id, value, body)
  select p_room, p_round, p_player, p_kind,
         nullif(i ->> 'question_id', '')::uuid,
         nullif(i ->> 'target_id', '')::uuid,
         (i ->> 'value')::smallint,
         i ->> 'body'
  from jsonb_array_elements(p_inputs) i
  on conflict (
    player_id, round, kind,
    coalesce(question_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) do update set value = excluded.value, body = excluded.body;

  -- A ranking is one row per player; it counts once per prompt.
  select case when p_kind = 'rank' then count(distinct question_id) else count(*) end into v_count
  from public.mode_inputs
  where player_id = p_player and round = p_round and kind = p_kind;

  if p_kind in ('rating', 'vote', 'rank') then
    update public.players
    set answered_count = v_count, last_answer_at = v_at
    where id = p_player;

    perform realtime.send(
      jsonb_build_object('playerId', p_player, 'answered', v_count, 'round', p_round, 'at', v_at),
      'progress',
      'room:' || p_room::text,
      true
    );
  end if;
  return v_count;
end;
$$;

revoke execute on function public.save_mode_inputs(uuid, uuid, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_mode_inputs(uuid, uuid, int, text, jsonb) to service_role;
