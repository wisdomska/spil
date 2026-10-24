-- Hot Takes (Batch 1, game mode 2): players rate statements 0 to 100, then guess the room's
-- average. Packs get a format so statement packs and yes or no packs never mix, the first
-- statement pack ships here (so it reaches every environment), and ratings report live progress
-- like answers do (SPIL-03).
-- Rollback: supabase/rollbacks/20261024001800_hot_takes.down.sql

alter table public.packs
  add column format text not null default 'yes_no' check (format in ('yes_no', 'statements'));

insert into public.packs
  (id, name, blurb, icon, tone, is_adult, heat, region, status, sort_order, min_age, section, spice, format)
values
  ('hot_takes', 'Hot Takes', 'Opinions, rated 0 to 100. No wrong answers, only spicy ones.',
   'mask-happy', 'accent', false, null, null, 'live', 15, 13, 'everyday', 2, 'statements')
on conflict (id) do nothing;

insert into public.questions (pack_id, text, is_sample)
select 'hot_takes', t.text, t.sample
from (values
  ('Pineapple belongs on pizza.', true),
  ('Jollof tastes better the next day.', false),
  ('Voice notes longer than a minute should be illegal.', true),
  ('Replying with just "k" is rude.', false),
  ('Breakfast is the best meal of the day.', false),
  ('Cats are better than dogs.', false),
  ('Sequels are never as good as the original.', false),
  ('Reading the last page of a book first is fine.', false),
  ('Leaving someone on read is worse than not opening the message.', true),
  ('Every group chat needs a strict no spam rule.', false),
  ('Cold showers beat hot showers.', false),
  ('Being early is just as annoying as being late.', false),
  ('Rice beats bread every time.', false),
  ('Matching outfits with your friends is iconic.', false),
  ('Spoilers do not ruin a good film.', false),
  ('Sleeping with socks on is completely fine.', false),
  ('A playlist says more than a letter.', false),
  ('Weekends should be three days long.', false),
  ('Rewatching a favourite show beats starting a new one.', false),
  ('Group projects teach you nothing.', false),
  ('The window seat beats the aisle seat.', false),
  ('Texting is better than calling.', false),
  ('Birthdays are overrated.', false),
  ('Plain crisps are the best flavour.', false),
  ('You should always split the bill evenly.', false),
  ('Morning people cannot be trusted.', false),
  ('Music sounds better in the car.', false),
  ('Ketchup on jollof is a crime.', false),
  ('Phones should be banned at the dinner table.', false),
  ('Cereal for dinner is a valid meal.', false),
  ('Homework should not exist.', false),
  ('A good nap beats a night out.', false),
  ('Social media made friendships better.', false),
  ('Football is more fun to watch with strangers.', false),
  ('Remixes are usually better than the original song.', false),
  ('Fridays are better than Saturdays.', false)
) as t(text, sample)
where not exists (select 1 from public.questions q where q.pack_id = 'hot_takes');

-- Ratings report progress the way answers do: the player's count for the round, broadcast to the
-- room. Other kinds only return their count. Same signature, so the API call is unchanged.
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

  if p_kind = 'rating' then
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
