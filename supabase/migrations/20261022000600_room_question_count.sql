-- Host-chosen question count (the pack picker offers 5, 10, 15, 20, 30, 50 or all).
-- Null means "use settings.questions_per_game". See docs/DECISIONS.md.

alter table public.rooms
  add column question_count int check (question_count between 1 and 100);

comment on column public.rooms.question_count is
  'Questions to draw per round, chosen by the host. Null uses settings.questions_per_game.';
