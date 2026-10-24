# Migrations

Database changes made for the fix handoff (docs/SPIL_Fix_Handoff.md). Supabase CLI migrations
only run forward, so every migration has an undo script in `supabase/rollbacks/`. To undo one:
run its rollback script against the database, then mark the migration reverted so the CLI stops
counting it:

```bash
supabase migration repair --status reverted <version>
```

Apply order: staging first (`supabase db push` while linked to `cambebifktqgnbthumzq`), then
production when the release goes to `main`.

| Version        | Ticket  | What it does                                                                                                                                                                                                                                                                                                              | Data safety                                                                                                                                                                                                                 | Rollback                                                                                                                            |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 20261024000900 | SPIL-03 | `players.answered_count` and `players.last_answer_at`; `save_answers(player, room, round, answers)` saves a batch, updates the count in the same transaction and broadcasts a `progress` event to `room:{id}`. Service role only.                                                                                         | Additive. Existing rows get 0 and null; answers are untouched.                                                                                                                                                              | `supabase/rollbacks/20261024000900_answer_progress.down.sql` drops the function and both columns. Answers stay.                     |
| 20261024001000 | SPIL-02 | `age_band` enum (`13_15`, `16_17`, `18_plus`) and `band_floor()`; `players.age_band` (default `13_15`), `packs.min_age` and `rooms.min_age` (13, 16 or 18); `settings.age_lock_hours` (default 24); `start_round` refuses a pack above any active player's band (`PACK_NOT_ALLOWED`) instead of checking `age_confirmed`. | Additive. Adult packs get `min_age` 18, rooms copy their pack's, players who had confirmed 18+ (and test players) get `18_plus`, everyone else the safe `13_15`. `players.age_confirmed` and `packs.heat` are kept, unused. | `supabase/rollbacks/20261024001000_age_bands.down.sql` restores the old `start_round` and drops the new columns, function and type. |

RLS: `players.age_band` is not in the column grants, so clients can neither read nor write it (pgTAP `07_age_bands_test.sql`); only the API writes it. Seed: adult packs get `min_age` 18.

SPIL-03 RLS: the new columns sit on `players`, which already has row level security; members read them
through the existing policies. pgTAP: `supabase/tests/06_answer_progress_test.sql`. Seed: no
change needed (the columns have defaults).
