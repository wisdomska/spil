-- Most Likely To (Batch 1, game mode 3): everyone votes, in private, for the player most likely to
-- do each prompt. Packs get a third format for prompts, the first prompt pack ships here, and a
-- vote replaces the player's earlier vote on the same prompt (one vote per prompt). Votes report
-- live progress like answers and ratings.
-- Rollback: supabase/rollbacks/20261024001900_most_likely.down.sql

alter table public.packs drop constraint if exists packs_format_check;
alter table public.packs
  add constraint packs_format_check check (format in ('yes_no', 'statements', 'prompts'));

insert into public.packs
  (id, name, blurb, icon, tone, is_adult, heat, region, status, sort_order, min_age, section, spice, format)
values
  ('most_likely', 'Most Likely To', 'Who in the room would do it? Vote in secret, see who the room picks.',
   'sparkle', 'raised', false, null, null, 'live', 16, 13, 'everyday', 1, 'prompts')
on conflict (id) do nothing;

-- Stored without "Most likely to"; the app shows that part. Light and kind by design.
insert into public.questions (pack_id, text, is_sample)
select 'most_likely', t.text, t.sample
from (values
  ('forget their own birthday', true),
  ('become famous by accident', true),
  ('reply to a text three days later', false),
  ('cry at a cartoon', false),
  ('get lost with the map open', true),
  ('start a business before they turn 25', false),
  ('win a dance battle', false),
  ('adopt ten pets', false),
  ('fall asleep at a party', false),
  ('laugh at the wrong moment', false),
  ('know every word of an old song', false),
  ('eat the last slice without asking', false),
  ('plan the whole group trip', false),
  ('show up late to their own party', false),
  ('survive a zombie movie', false),
  ('lose their phone while holding it', false),
  ('take the best group photo', false),
  ('talk their way out of anything', false),
  ('win a reality show', false),
  ('keep a secret forever', false),
  ('forget why they walked into a room', false),
  ('start a new trend', false),
  ('cook for the whole street', false),
  ('try every flavour on the menu', false),
  ('win a quiz night on their own', false),
  ('text the wrong group chat', false),
  ('give the best advice', false),
  ('make friends with a stranger on a bus', false),
  ('keep every receipt', false),
  ('end up being the boss', false),
  ('read all the terms and conditions', false),
  ('cheer the loudest at a match', false),
  ('sing in the shower every morning', false),
  ('own the most sneakers', false),
  ('become a teacher', false),
  ('remember everyone''s birthday', false)
) as t(text, sample)
where not exists (select 1 from public.questions q where q.pack_id = 'most_likely');

-- One vote per prompt: a new vote on a prompt replaces the old one, whoever it was for. Ratings
-- and votes report progress (count for the round, broadcast to the room); other kinds only
-- return their count. Same signature, so the API call is unchanged.
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
  if p_kind = 'vote' then
    delete from public.mode_inputs m
    where m.player_id = p_player and m.round = p_round and m.kind = 'vote'
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

  select count(*) into v_count
  from public.mode_inputs
  where player_id = p_player and round = p_round and kind = p_kind;

  if p_kind in ('rating', 'vote') then
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
