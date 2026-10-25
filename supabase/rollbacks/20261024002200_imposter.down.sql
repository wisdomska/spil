-- Reverses 20261024002200_imposter.sql. Afterwards run
--   supabase migration repair --status reverted 20261024002200
-- Rooms that played Imposter point at the pack; they are deleted with it (rooms last 7 days).

delete from public.rooms where pack_id = 'imposter';
delete from public.packs where id = 'imposter';
drop table if exists public.imposters;
alter table public.questions drop column if exists alt_text;
alter table public.packs drop constraint if exists packs_format_check;
alter table public.packs
  add constraint packs_format_check check (format in ('yes_no', 'statements', 'prompts', 'flags'));

-- save_mode_inputs as it was in 20261024002100.
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
  if p_kind in ('vote', 'rank') then
    delete from public.mode_inputs m
    where m.player_id = p_player and m.round = p_round and m.kind = p_kind
      and m.question_id in (
        select nullif(i ->> 'question_id', '')::uuid from jsonb_array_elements(p_inputs) i
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
