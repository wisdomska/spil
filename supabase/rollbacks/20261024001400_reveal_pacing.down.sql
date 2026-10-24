-- Reverses 20261024001400_reveal_pacing.sql. Reveals go back to client timing. Afterwards run
--   supabase migration repair --status reverted 20261024001400
drop trigger if exists rooms_broadcast_reveal on public.rooms;
alter table public.rooms drop column if exists reveal_at, drop column if exists reveal_index;
