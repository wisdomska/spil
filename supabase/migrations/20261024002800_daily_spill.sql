-- Daily Spill (Batch 2): one question a day for everyone. Each person answers once a day, tied to
-- their anonymous session; only the API reads the table (for the day's count), so nobody can see
-- anyone else's answer.
-- Rollback: supabase/rollbacks/20261024002800_daily_spill.down.sql

create table public.daily_answers (
  day date not null,
  user_id uuid not null,
  question_id uuid not null references public.questions (id) on delete cascade,
  value public.answer_value not null check (value in ('yes', 'no')),
  created_at timestamptz not null default now(),
  primary key (day, user_id)
);
create index daily_answers_day_idx on public.daily_answers (day);
alter table public.daily_answers enable row level security;
-- No policies: players never read or write it directly; the API does, with the service role.
revoke all on public.daily_answers from anon, authenticated;
