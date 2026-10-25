-- Party Mode (migration 2600).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_column('public', 'rooms', 'tv_token', 'rooms can be paired with a big screen');
select col_is_null('public', 'rooms', 'tv_token', 'rooms start without a screen');
select throws_ok(
  $$ insert into public.rooms (code, pack_id, created_by, tv_token) values ('TVAA', 'classic', gen_random_uuid(), 'short') $$,
  '23514', null, 'tokens are long'
);

select * from finish();
rollback;
