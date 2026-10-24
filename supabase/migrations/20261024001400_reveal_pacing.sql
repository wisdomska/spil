-- SPIL-11: the reveal is paced by the host and driven by the server. reveal_index is the slide
-- every phone shows (one per tie group, then one per award; equal to the slide count when the
-- reveal is over) and reveal_at is when that slide began, so phones stay in step.
-- Rollback: supabase/rollbacks/20261024001400_reveal_pacing.down.sql

alter table public.rooms
  add column reveal_index int not null default 0 check (reveal_index >= 0),
  add column reveal_at timestamptz;

-- Rooms revealed before this release are over: never replay their reveal.
update public.rooms set reveal_index = 1000 where status in ('revealed', 'closed');

-- Every slide change reaches the room's phones like any other room change.
create trigger rooms_broadcast_reveal
  after update of reveal_index on public.rooms
  for each row
  when (old.reveal_index is distinct from new.reveal_index)
  execute function public.broadcast_room_change();
