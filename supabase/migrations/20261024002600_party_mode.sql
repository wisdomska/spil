-- Party Mode (Batch 2): a big screen shows the room while phones are the controllers. The host
-- pairs the screen with a secret link; the screen reads a cut-down room view with that token and
-- no account. Behind the party_mode flag.
-- Rollback: supabase/rollbacks/20261024002600_party_mode.down.sql

alter table public.rooms
  add column tv_token text unique check (tv_token is null or char_length(tv_token) between 24 and 64);
