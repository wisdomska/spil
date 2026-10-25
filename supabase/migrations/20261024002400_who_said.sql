-- Who Said That? (Batch 1, game mode 8, 18+ rooms only): everyone writes a short answer to each
-- prompt, then guesses who wrote each of the others' answers. Answers are mode inputs of kind
-- text (filtered by the API before saving). Guesses get their own table, one per player and
-- answer. A reported answer is hidden for everyone and the report reaches the admin console.
-- Rollback: supabase/rollbacks/20261024002400_who_said.down.sql

alter type public.report_type add value if not exists 'answer';

alter table public.mode_inputs add column hidden boolean not null default false;

alter table public.reports
  add column mode_input_id uuid references public.mode_inputs (id) on delete set null;
create index reports_mode_input_id_idx on public.reports (mode_input_id);

alter table public.packs drop constraint if exists packs_format_check;
alter table public.packs
  add constraint packs_format_check
  check (format in ('yes_no', 'statements', 'prompts', 'flags', 'pairs', 'open'));

create table public.text_guesses (
  player_id uuid not null references public.players (id) on delete cascade,
  answer_id uuid not null references public.mode_inputs (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  round int not null check (round >= 1),
  author_id uuid not null references public.players (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (player_id, answer_id)
);
create index text_guesses_room_round_idx on public.text_guesses (room_id, round);
alter table public.text_guesses enable row level security;
-- A player reads their own guesses, and everyone's once the room is revealed. The API writes.
create policy text_guesses_select_own on public.text_guesses
  for select to authenticated
  using (player_id in (select public.current_player_ids()));
create policy text_guesses_select_revealed on public.text_guesses
  for select to authenticated
  using (public.is_room_revealed(room_id));
revoke all on public.text_guesses from anon, authenticated;
grant select on public.text_guesses to authenticated;

insert into public.packs
  (id, name, blurb, icon, tone, is_adult, heat, region, status, sort_order, min_age, section, spice, format)
values
  ('who_said', 'Who Said That?', 'Write short answers, then guess who wrote what. 18+ only. Names are revealed at the end.',
   'chat-circle-dots', 'inverse', true, 'spicy', null, 'live', 60, 18, 'after_dark', 3, 'open')
on conflict (id) do nothing;

insert into public.questions (pack_id, text, is_sample)
select 'who_said', t.text, t.sample
from (values
  ('What''s the worst date you''ve ever been on, in one line?', true),
  ('What''s your most embarrassing drunk moment?', true),
  ('What''s the pettiest thing you''ve ever done?', true),
  ('What''s a lie you told that got out of hand?', false),
  ('What''s the weirdest thing you''ve done for money?', false),
  ('What''s your most unpopular opinion?', false),
  ('What''s the worst text you''ve sent to the wrong person?', false),
  ('What''s a secret talent nobody here knows about?', false),
  ('What''s the strangest place you''ve fallen asleep?', false),
  ('What''s the most money you''ve wasted on something silly?', false),
  ('What''s your worst habit?', false),
  ('What''s the cringiest thing you did to impress a crush?', false),
  ('What''s the worst excuse you''ve used to leave a party?', false),
  ('What would your autobiography be called?', false),
  ('What''s the most trouble you got into as a teenager?', false),
  ('What''s the boldest thing you''ve said to a boss or teacher?', false),
  ('What''s a rumour about you that was actually true?', false),
  ('What''s the most chaotic thing in your camera roll?', false),
  ('What''s the worst haircut you''ve ever had?', false),
  ('What''s the longest you''ve gone without showering?', false),
  ('What''s the most embarrassing song you know every word to?', false),
  ('What''s something you pretend to like?', false),
  ('What''s your go-to lie when you''re running late?', false),
  ('What''s the wildest thing you''ve done on a dare?', false),
  ('What''s the first thing you''d do if you won the lottery?', false),
  ('What''s the worst gift you''ve ever received?', false),
  ('What''s a red flag you ignored?', false),
  ('What''s your most irrational fear?', false),
  ('What''s the oddest thing you''ve eaten?', false),
  ('What''s the most awkward thing you''ve said in an interview?', false)
) as t(text, sample)
where not exists (select 1 from public.questions q where q.pack_id = 'who_said');
