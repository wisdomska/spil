-- SPIL-02: age bands, pack and room minimum ages, the age lock setting (migration 1000).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_type('public', 'age_band', 'age_band type exists');
select enum_has_labels('public', 'age_band', array['13_15', '16_17', '18_plus'], 'three bands, never an exact age');
select has_column('public', 'players', 'age_band', 'players store a band');
select col_default_is('public', 'players', 'age_band', '13_15'::public.age_band, 'the safe default band is 13_15');
select has_column('public', 'packs', 'min_age', 'packs have a minimum age');
select has_column('public', 'rooms', 'min_age', 'rooms cache their pack minimum age');

select is(public.band_floor('13_15'), 13::smallint, '13_15 floor is 13');
select is(public.band_floor('16_17'), 16::smallint, '16_17 floor is 16');
select is(public.band_floor('18_plus'), 18::smallint, '18_plus floor is 18');

select is(
  (select count(*)::int from public.packs where is_adult and min_age <> 18),
  0,
  'every adult pack has minimum age 18'
);

select throws_ok(
  $$ update public.packs set min_age = 15 where id = 'classic' $$,
  '23514',
  null,
  'minimum age is 13, 16 or 18'
);

select is((select age_lock_hours from public.settings), 24, 'age lock defaults to 24 hours');

-- Clients never read a band, not even their own.
select ok(
  not has_column_privilege('authenticated', 'public.players', 'age_band', 'select'),
  'players cannot read age bands'
);
select ok(
  not has_column_privilege('authenticated', 'public.players', 'age_band', 'update'),
  'players cannot write age bands'
);

select * from finish();
rollback;
