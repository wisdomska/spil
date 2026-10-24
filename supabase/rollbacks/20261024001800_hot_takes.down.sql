-- Reverses 20261024001800_hot_takes.sql. Afterwards run
--   supabase migration repair --status reverted 20261024001800
-- Rooms that played Hot Takes point at the pack; they are deleted with it (rooms last 7 days).

delete from public.rooms where pack_id = 'hot_takes';
delete from public.packs where id = 'hot_takes';
alter table public.packs drop column if exists format;

-- save_mode_inputs as it was in 20261024001700 (no rating progress).
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
begin
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

  select count(*) into v_count
  from public.mode_inputs
  where player_id = p_player and round = p_round and kind = p_kind;
  return v_count;
end;
$$;

revoke execute on function public.save_mode_inputs(uuid, uuid, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_mode_inputs(uuid, uuid, int, text, jsonb) to service_role;
