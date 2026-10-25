-- Who Said That? (migration 2400).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_table('public', 'text_guesses', 'guesses on written answers have their own table');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.text_guesses'::regclass),
  'text_guesses has row level security'
);
select policies_are(
  'public', 'text_guesses', array['text_guesses_select_own', 'text_guesses_select_revealed'],
  'players read their own guesses, and everyone after the reveal'
);
select ok(not has_table_privilege('anon', 'public.text_guesses', 'select'), 'anon cannot read guesses');
select ok(not has_table_privilege('authenticated', 'public.text_guesses', 'insert'), 'players cannot write guesses');
select has_column('public', 'mode_inputs', 'hidden', 'answers can be hidden after a report');
select has_column('public', 'reports', 'mode_input_id', 'a report can point at a written answer');
select is(
  (select min_age::int from public.packs where id = 'who_said'), 18,
  'Who Said That? is an 18+ pack'
);
select ok(
  (select count(*) from public.questions where pack_id = 'who_said' and status = 'live') >= 30,
  'Who Said That? ships with 30 or more prompts'
);

select * from finish();
rollback;
