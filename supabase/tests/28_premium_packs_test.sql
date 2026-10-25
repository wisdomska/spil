-- Premium packs (migration 3300).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select has_column('public', 'packs', 'premium', 'packs can be marked premium');
select is((select count(*)::int from public.packs where premium), 0, 'no pack starts premium');
select * from finish();
rollback;
