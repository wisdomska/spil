-- Rank the Room (migration 2100).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.rooms (id, code, pack_id, created_by, mode)
values ('00000000-0000-4000-8000-0000000000c4', 'RNKA', 'most_likely', gen_random_uuid(), 'rank_room');
insert into public.players (id, room_id, user_id, nickname, avatar, rotation_seed) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000c4', gen_random_uuid(), 'Ama', 1, 1),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000c4', gen_random_uuid(), 'Kofi', 2, 2),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000c4', gen_random_uuid(), 'Esi', 3, 3);

-- One prompt ranked: three rows, counted once.
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000c4', 1, 'rank',
    (select jsonb_agg(jsonb_build_object('question_id', q.id, 'target_id', p.id, 'value', p.n))
     from (select id from public.questions where pack_id = 'most_likely' order by id limit 1) q,
          (values ('00000000-0000-4000-8000-0000000000e1'::uuid, 1),
                  ('00000000-0000-4000-8000-0000000000e2'::uuid, 2),
                  ('00000000-0000-4000-8000-0000000000e3'::uuid, 3)) as p(id, n))),
  1, 'a ranking counts once per prompt'
);
-- Ranked again with only two players (one left): the old ranking is replaced, not added to.
select is(
  public.save_mode_inputs('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000c4', 1, 'rank',
    (select jsonb_agg(jsonb_build_object('question_id', q.id, 'target_id', p.id, 'value', p.n))
     from (select id from public.questions where pack_id = 'most_likely' order by id limit 1) q,
          (values ('00000000-0000-4000-8000-0000000000e2'::uuid, 1),
                  ('00000000-0000-4000-8000-0000000000e1'::uuid, 2)) as p(id, n))),
  1, 'still one prompt after ranking it again'
);
select is(
  (select count(*)::int from public.mode_inputs
   where player_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'rank'),
  2, 'a new ranking replaces the old rows'
);
select is(
  (select answered_count from public.players where id = '00000000-0000-4000-8000-0000000000e1'), 1,
  'rankings count as answered'
);

select * from finish();
rollback;
