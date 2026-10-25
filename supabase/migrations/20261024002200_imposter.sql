-- Imposter (Batch 1, game mode 6): everyone answers the same questions from 0 to 100, except one
-- secret player who gets a different question each time and is not told. Answers are shown to
-- the room in this mode, so it plays only harmless pairs packs: each question has the imposter's
-- alternative in questions.alt_text. Who the imposter is lives in its own table that nobody can
-- read before the reveal. A changed vote with no question (the imposter vote) also replaces the
-- old one now.
-- Rollback: supabase/rollbacks/20261024002200_imposter.down.sql

alter table public.questions
  add column alt_text text check (alt_text is null or char_length(alt_text) between 8 and 120);

alter table public.packs drop constraint if exists packs_format_check;
alter table public.packs
  add constraint packs_format_check
  check (format in ('yes_no', 'statements', 'prompts', 'flags', 'pairs'));

create table public.imposters (
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null check (round >= 1),
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, round)
);
alter table public.imposters enable row level security;
-- Members read it only once their room is revealed; the API (service role) writes it.
create policy imposters_select_revealed on public.imposters
  for select to authenticated
  using (public.is_room_revealed(room_id));
revoke all on public.imposters from anon, authenticated;
grant select on public.imposters to authenticated;

insert into public.packs
  (id, name, blurb, icon, tone, is_adult, heat, region, status, sort_order, min_age, section, spice, format)
values
  ('imposter', 'Imposter', 'Easy questions, one player gets different ones. Answers are shown, so spot who is off.',
   'game-controller', 'raised', false, null, null, 'live', 18, 13, 'everyday', 1, 'pairs')
on conflict (id) do nothing;

insert into public.questions (pack_id, text, alt_text, is_sample)
select 'imposter', t.text, t.alt, t.sample
from (values
  ('How much do you love pizza?', 'How much do you love salad?', true),
  ('How good are you at cooking?', 'How good are you at singing?', true),
  ('How much do you enjoy Mondays?', 'How much do you enjoy Fridays?', false),
  ('How scary are spiders?', 'How scary are puppies?', true),
  ('How often do you check your phone?', 'How often do you check the weather?', false),
  ('How much do you like rainy days?', 'How much do you like sunny days?', false),
  ('How tidy is your room?', 'How tidy is your phone''s home screen?', false),
  ('How loud is your laugh?', 'How loud is your alarm clock?', false),
  ('How much do you like horror films?', 'How much do you like cartoons?', false),
  ('How much do you like waking up early?', 'How much do you like staying up late?', false),
  ('How spicy do you like your food?', 'How sweet do you like your tea?', false),
  ('How much do you love the beach?', 'How much do you love the snow?', false),
  ('How good is your sense of direction?', 'How good is your memory for names?', false),
  ('How much do you like group chats?', 'How much do you like phone calls?', false),
  ('How patient are you in traffic?', 'How patient are you in a queue?', false),
  ('How much do you like dancing?', 'How much do you like karaoke?', false),
  ('How much do you enjoy exams?', 'How much do you enjoy holidays?', false),
  ('How much do you like dogs?', 'How much do you like cats?', false),
  ('How fast do you reply to texts?', 'How fast do you walk?', false),
  ('How much do you like jollof?', 'How much do you like plain rice?', false),
  ('How much do you like football?', 'How much do you like chess?', false),
  ('How competitive are you at games?', 'How competitive are you at cooking?', false),
  ('How much do you like surprises?', 'How much do you like routines?', false),
  ('How brave are you on rollercoasters?', 'How brave are you at the dentist?', false),
  ('How much do you love your bed?', 'How much do you love your alarm?', false),
  ('How much do you like selfies?', 'How much do you like group photos?', false),
  ('How messy is your handwriting?', 'How messy is your bag?', false),
  ('How much do you like long walks?', 'How much do you like long films?', false),
  ('How much do you like baking?', 'How much do you like washing up?', false),
  ('How much do you like trying new food?', 'How much do you like eating the same meal every day?', false)
) as t(text, alt, sample)
where not exists (select 1 from public.questions q where q.pack_id = 'imposter');

-- One vote per slot, including votes with no question (the imposter vote).
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
