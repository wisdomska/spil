-- Premium packs (Batch 3, owner decision: free for now). An admin can mark a pack premium. While
-- the payments_enabled flag is off (today) every pack stays free and nothing is shown; with it on,
-- premium packs are marked and cannot be played until checkout exists.
-- Rollback: supabase/rollbacks/20261024003300_premium_packs.down.sql

alter table public.packs add column premium boolean not null default false;
