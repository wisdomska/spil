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

| Version        | Ticket  | What it does                                                                                                                                                                                                                      | Data safety                                                    | Rollback                                                                                                        |
| -------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 20261024000900 | SPIL-03 | `players.answered_count` and `players.last_answer_at`; `save_answers(player, room, round, answers)` saves a batch, updates the count in the same transaction and broadcasts a `progress` event to `room:{id}`. Service role only. | Additive. Existing rows get 0 and null; answers are untouched. | `supabase/rollbacks/20261024000900_answer_progress.down.sql` drops the function and both columns. Answers stay. |

RLS: the new columns sit on `players`, which already has row level security; members read them
through the existing policies. pgTAP: `supabase/tests/06_answer_progress_test.sql`. Seed: no
change needed (the columns have defaults).
