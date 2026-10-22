# Database reference

Postgres (Supabase) schema for SPIL. Source of truth is `supabase/migrations`; the design is in docs/TECH_SPEC.md sections 9 to 11. Seed data for local and CI is `supabase/seed.sql`; pgTAP tests are in `supabase/tests`.

## Running it

- Local (needs Docker): `supabase start`, `supabase db reset`, `supabase test db`.
- CI: the `db` job in `.github/workflows/ci.yml` runs the same three commands on every PR.
- The seed never reaches production. Production content is loaded separately (see docs/OPEN_ITEMS.md for the Purity pack).

## Migrations

| File                    | Contents                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `..._enums_and_content` | Enums, `packs`, `questions`, `settings`, `feature_flags`, `set_updated_at` trigger       |
| `..._rooms`             | `rooms`, `room_questions`, `players`, `answers`, `guesses`, `results`, `awards`          |
| `..._ops`               | `reports`, `messages`, `admins`, `audit_log`, `rate_limits`, `stats_daily`, `pack_plays` |
| `..._functions`         | Helper, game and realtime functions, triggers, function privileges                       |
| `..._rls`               | RLS on every table, grants, policies, `players_public` view, realtime policies           |

## Tables

| Table            | Purpose                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `packs`          | Question packs. Slug id, `status` live/draft/hidden, `is_adult` + `heat`                     |
| `questions`      | Question text (stored without "Have you ever"), status, yes and answered counters            |
| `settings`       | Singleton: questions per game (12), max players (12), min players (3)                        |
| `feature_flags`  | `polling_only`, `adult_packs_enabled`, `test_players`, `payments_enabled`, `party_mode`      |
| `rooms`          | One row per room. `round` and `final_round` (finalize guard), phase timestamps, 7 day expiry |
| `room_questions` | Questions drawn for each round, in order                                                     |
| `players`        | Players in a room, keyed to the anonymous `auth.uid()`                                       |
| `answers`        | Yes, no or skip per player, round and question                                               |
| `guesses`        | Score guesses, guesser to target, per round                                                  |
| `results`        | Final score, label, room guess, mind reader and rank per player and round                    |
| `awards`         | The six awards per round                                                                     |
| `reports`        | Player reports of questions or nicknames                                                     |
| `messages`       | Contact form inbox                                                                           |
| `admins`         | Admin allow-list with role owner, content_lead or moderator                                  |
| `audit_log`      | Every admin action                                                                           |
| `rate_limits`    | Fixed window counters for `check_rate_limit`                                                 |
| `stats_daily`    | Games started, finished and joins per day                                                    |
| `pack_plays`     | Games started per pack per day                                                               |

`players_public` is a `security_invoker` view over `players` + `rooms` exposing id, room_id, nickname, avatar, rotation_seed, status, answers_submitted, guesses_submitted, spill_mode, is_host and joined_at.

## Functions

All are `security definer` with `set search_path = ''` (except two trigger helpers, below). Errors use the API error code as the message, e.g. `WRONG_PHASE`.

| Function                                     | Who                 | What                                                                                                                                                        |
| -------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_room_member(room)`                       | policies            | Caller has a player in the room with status active or sat_out                                                                                               |
| `is_admin(roles default null)`               | policies            | Caller is in `admins`, optionally with one of the roles                                                                                                     |
| `current_player_ids()`                       | policies            | The caller's player ids                                                                                                                                     |
| `is_room_revealed(room)`                     | policies            | Member and room status is revealed                                                                                                                          |
| `can_access_room_topic(topic)`               | realtime policies   | Topic is `room:{uuid}` and the caller is a member                                                                                                           |
| `check_rate_limit(key, limit, window)`       | service role        | Counts a hit, returns false when over the limit                                                                                                             |
| `expire_rooms()`                             | service role (cron) | Closes lobbies older than 24 h, deletes rooms past `expires_at`, deletes stale anonymous users with no players, prunes rate limits. Returns counts as jsonb |
| `advance_room(room, from, to)`               | service role        | Row lock, `WRONG_PHASE` if status is not `from`, `INVALID_TRANSITION` for skips, sets the phase timestamp. Returns the room                                 |
| `save_results(room, round, results, awards)` | service role        | Idempotent via `final_round`; needs status ready. Inserts results and awards, adds answer stats (bots excluded), counts the finished game, sets revealed    |
| `start_round(room, pack, n)`                 | service role        | From lobby or revealed. Clears answers and guesses, resets per-round player state, draws n random live questions, sets answering. Adult gate keeps lobby    |
| `nudge(room, player)`                        | service role        | Broadcasts `nudge` with `targetPlayerId` on `room:{id}`                                                                                                     |
| `broadcast_room_change()`                    | trigger on rooms    | `room_changed` (or `room_closed`) on status, round or host change                                                                                           |
| `broadcast_player_change()`                  | trigger on players  | `player_changed` on insert, delete, status, submitted flags, spill mode, nickname, avatar                                                                   |
| `set_updated_at()`                           | trigger (invoker)   | Keeps `updated_at` current                                                                                                                                  |
| `guard_question_update()`                    | trigger (invoker)   | A moderator may only set a question to hidden                                                                                                               |

`save_results` payloads use column names: `[{player_id, spill_score, label, avg_guess_about, mind_reader, rank}]` and `[{award, player_id, reason, position}]`.

`start_round` round rule: the round number goes up only when the current round is already final (`final_round >= round`), so the first start keeps round 1 and a rematch never double counts.

## Policies

Grants are least privilege: `anon` and `authenticated` get `select` only (players: public columns only, rate_limits: nothing), plus admin writes on packs, questions, settings and feature_flags. Game writes use the service role.

| Table                                                         | Select                                                      | Client writes                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| packs                                                         | live, or any admin                                          | owner, content_lead                                       |
| questions                                                     | live in a live pack, or any admin                           | owner, content_lead; moderator may only set status hidden |
| settings, feature_flags                                       | everyone                                                    | owner (settings: update only)                             |
| rooms                                                         | member or any admin                                         | none                                                      |
| room_questions, players                                       | member                                                      | none                                                      |
| answers                                                       | own; others after reveal when that player has Spill Mode on | none                                                      |
| guesses                                                       | own; all room guesses after reveal                          | none                                                      |
| results, awards                                               | member after reveal                                         | none                                                      |
| reports, messages, admins, audit_log, stats_daily, pack_plays | any admin                                                   | none                                                      |
| rate_limits                                                   | none                                                        | none                                                      |
| realtime.messages                                             | members of `room:{id}` (broadcast and presence)             | members may track presence                                |

## Realtime

Private channel `room:{roomId}`. Events: `room_changed` (payload has `revealed_at` for reveal sync), `room_closed`, `player_changed`, `nudge` (payload has `targetPlayerId`). Clients refetch `/state` on any event.
