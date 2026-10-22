-- Counts a join for the admin Overview (stats_daily.joins). Service role only.
create function public.record_join()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.stats_daily as sd (day, joins)
  values ((now() at time zone 'utc')::date, 1)
  on conflict (day) do update set joins = sd.joins + 1;
$$;

revoke execute on function public.record_join() from public, anon, authenticated;
