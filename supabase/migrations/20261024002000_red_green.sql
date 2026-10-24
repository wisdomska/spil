-- Red Flag, Green Flag (Batch 1, game mode 4): everyone swipes friendship and crush scenarios
-- green or red in private, then the reveal shows each scenario's split. Answers reuse the yes or
-- no answers table (yes is green, no is red), so only a pack format and the first pack are new.
-- Rollback: supabase/rollbacks/20261024002000_red_green.down.sql

alter table public.packs drop constraint if exists packs_format_check;
alter table public.packs
  add constraint packs_format_check check (format in ('yes_no', 'statements', 'prompts', 'flags'));

insert into public.packs
  (id, name, blurb, icon, tone, is_adult, heat, region, status, sort_order, min_age, section, spice, format)
values
  ('red_green', 'Red Flag, Green Flag', 'Friends and crushes. Swipe green or red, then see where the room stands.',
   'heart', 'inverse', false, null, null, 'live', 17, 13, 'everyday', 2, 'flags')
on conflict (id) do nothing;

insert into public.questions (pack_id, text, is_sample)
select 'red_green', t.text, t.sample
from (values
  ('They reply to every text within a minute.', true),
  ('They remember your order after one hangout.', false),
  ('They post every hangout on their story.', true),
  ('They still talk to their ex every day.', false),
  ('They ask your friends what you like before your birthday.', false),
  ('They never ask how your day was.', false),
  ('They laugh at their own jokes.', false),
  ('They share their food without being asked.', false),
  ('They cancel plans an hour before.', true),
  ('They know all your friends'' names.', false),
  ('They correct your grammar in texts.', false),
  ('They send voice notes instead of texts.', false),
  ('They already have a five year plan.', false),
  ('They text "we need to talk" and go offline.', false),
  ('They hype you up in the group chat.', false),
  ('They keep score of who paid last.', false),
  ('They borrow your clothes without asking.', false),
  ('They reply "haha" to everything.', false),
  ('They plan surprise days out.', false),
  ('They check your phone when you leave the room.', false),
  ('They are still friends with all their exes.', false),
  ('They apologise first after a fight.', false),
  ('They show up early to help you set up.', false),
  ('They only text when they need something.', false),
  ('They remember small things you said weeks ago.', false),
  ('They spoil films they have already seen.', false),
  ('They want you to meet their family straight away.', false),
  ('They like your photos from years ago.', false),
  ('They tell you when you have food in your teeth.', false),
  ('They talk badly about their friends to you.', false),
  ('They make a playlist just for you.', false),
  ('They are always "five minutes away".', false),
  ('They want to share locations all the time.', false),
  ('They come to cheer at your games and shows.', false),
  ('They read your messages and reply hours later.', false),
  ('They are kind to waiters and shop staff.', false)
) as t(text, sample)
where not exists (select 1 from public.questions q where q.pack_id = 'red_green');
