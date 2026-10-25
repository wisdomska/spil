-- Custom packs (migration 3000).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column('public', 'packs', 'room_id', 'a pack can belong to one room');

insert into public.rooms (id, code, pack_id, created_by, min_age)
values ('00000000-0000-4000-8000-0000000000c7', 'CUSA', 'classic', gen_random_uuid(), 18),
       ('00000000-0000-4000-8000-0000000000c8', 'CUSB', 'classic', gen_random_uuid(), 18);
insert into public.players (room_id, user_id, nickname, avatar, rotation_seed, age_band)
values ('00000000-0000-4000-8000-0000000000c7', gen_random_uuid(), 'Ama', 1, 1, '18_plus');
insert into public.packs (id, name, blurb, icon, tone, is_adult, heat, status, min_age, room_id)
values ('custom_cusa', 'Ama''s questions', 'Written by the host.', 'cards', 'raised', true, 'spicy', 'hidden', 18,
        '00000000-0000-4000-8000-0000000000c7');
insert into public.questions (pack_id, text) values ('custom_cusa', 'eaten a whole cake alone'), ('custom_cusa', 'sung in the shower');

select lives_ok(
  $$ select public.start_round('00000000-0000-4000-8000-0000000000c7', 'custom_cusa', 2) $$,
  'a room plays its own hidden pack'
);
select throws_ok(
  $$ select public.start_round('00000000-0000-4000-8000-0000000000c8', 'custom_cusa', 2) $$,
  'P0001', 'PACK_UNAVAILABLE', 'another room cannot'
);
select ok(
  not exists (select 1 from public.packs where id = 'custom_cusa' and status = 'live'),
  'custom packs stay hidden from the public list'
);
delete from public.rooms where id = '00000000-0000-4000-8000-0000000000c8';
delete from public.room_questions where room_id = '00000000-0000-4000-8000-0000000000c7';
delete from public.rooms where id = '00000000-0000-4000-8000-0000000000c7';
select ok(not exists (select 1 from public.packs where id = 'custom_cusa'), 'the pack goes with its room');

select * from finish();
rollback;
