# Features plan (after the fix handoff)

The owner asked on 2026-10-24 for every item in section 6 ("Out of scope") of
docs/SPIL_Fix_Handoff.md, after v1.5.0, plus solo play (done). The remaining fix tickets SPIL-12 to
SPIL-33 follow these features.

## Owner decisions

| Topic               | Decision                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Order               | New features first, then SPIL-12 to SPIL-33                                                                                                      |
| Payments            | Free for now. Cosmetics and achievements are free; premium packs are marked and gated by the existing `payments_enabled` flag (off). No checkout |
| Crews and seasons   | No signup: a crew is a saved group with an invite link; members are remembered by their anonymous session on each device                         |
| Player-written text | Profanity filter and reporting on everything players write, and only in rooms where everyone is 18+ (custom packs, Who Said That?)               |
| Solo                | A room can start with 1 player; guessing, room guess, Mind Reader points and awards drop out (done, v1.5.x)                                      |

## Batches

Every batch ships like a fix step: one commit per feature, admin cascade, pgTAP for new tables,
unit and e2e tests, screenshots at 375 and 1280 px, a QA entry, then a PR into preview.

### Batch 1: game modes on the current engine

A room gets a `mode` (default `classic`), chosen with the pack. Each mode reuses rooms, the lobby,
private phone input, the vessel, the host-paced reveal, labels, awards and share cards.

| Mode                   | How it plays                                                                                                                   | New pieces                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Room Percentage        | Each player guesses what percentage of the room said yes to each question; closest wins                                        | Per-question guess, reveal per question |
| Hot Takes              | Statements rated 0 to 100 with the vessel; guess the room's average                                                            | Statement packs, average reveal         |
| Most Likely To         | Everyone votes for a player per prompt; the reveal names the room's pick                                                       | Vote input, vote tally                  |
| Red Flag, Green Flag   | Swipe red or green on dating and friendship scenarios; reveal the split                                                        | Content packs on the swipe engine       |
| Rank the Room          | Order players on a prompt; points for matching the room's order                                                                | Drag-to-rank input                      |
| Imposter               | Everyone but one gets the same question; find who had a different one                                                          | Secret role, vote                       |
| Two Truths and a Spill | Each player picks two true yeses and one fake from their answers; others spot the fake                                         | Pick input, vote                        |
| Who Said That?         | Short written answers (18+ rooms only, filtered); guess who wrote each                                                         | Text input, moderation, guess input     |
| Spill or Skip          | After the reveal the room votes for one yes they want the story behind; only Spill Mode players can be picked, anyone can pass | Vote after results                      |

### Batch 2: playing together

- Party Mode: a big-screen view at `/r/[code]/tv` (the `party_mode` flag exists) showing the lobby, progress and the reveal while phones are controllers.
- Live emoji reactions during the reveal (a few fixed emoji, rate limited, broadcast on the room channel).
- Daily Spill: one question a day for everyone, with a streak kept on the device.

### Batch 3: coming back

- Crews: save a group after a game, invite link, crew history; season leaderboards (Mind Reader points per crew per month).
- Custom packs written by hosts: 18+ rooms only, profanity filter, reportable, visible to the room that made them.
- Teen, seasonal and local packs: SHS Days, Exam Season, Church Kid, Detty December (content work; 16+ tier exists).
- Achievements and cosmetics (free): badges for milestones, card themes and avatar frames; premium packs marked and gated by `payments_enabled`.

## Then

SPIL-12 to SPIL-33 in the handoff's step order (Step 4, then Step 5), and the final deliverables:
QA_REPORT, MIGRATIONS, CHANGELOG and FOLLOW_UPS.
