# QA report: fix handoff

Test matrix, defects and sign-offs for the 33 tickets in docs/SPIL_Fix_Handoff.md. The earlier
v1.0 report is docs/QA_REPORT.md.

## Phase 0 (2026-10-24)

### Harness

- Multiplayer helpers in `tests/e2e/harness.ts` (see docs/qa/HARNESS.md). Self-test
  `tests/e2e/harness.spec.ts`: **pass**. It covers a 2-player game (host 1280 x 800, guest
  375 x 812) from create to results, with room creation passing Turnstile on the test keys, and an
  admin console session.
- Turnstile test keys in local and Vercel preview; real keys in production. `test_players` flag:
  on in staging, off in production (checked in both databases).

### Baseline screenshots

612 screenshots: 43 game and help screens and 8 admin sections at 12 viewports (320, 360, 375,
390, 414, 768, 1024, 1280, 1440, 1920, landscape 844 x 390, 200% zoom). Stored in
`tests/visual/baseline/` (not committed, 191 MB).

### Defects found in the baseline

| #   | Screen                               | Viewport | Defect                                       | Fixed in                                     |
| --- | ------------------------------------ | -------- | -------------------------------------------- | -------------------------------------------- |
| B1  | How to play, Privacy, Terms, Contact | 320 px   | Page scrolls sideways by 6 px (help tab bar) | SPIL-06 (adds the fifth tab to the same bar) |
| B2  | Landing                              | 320 px   | Page scrolls sideways by 2 px                | SPIL-22 (landing)                            |

No other screen scrolls sideways at any viewport.

## Tickets

| Ticket                      | Status      | 375 px                                                                              | 1280 px                                                                               | Chrome | Safari | Firefox    | QA sign-off                                                                      |
| --------------------------- | ----------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ | ------ | ---------- | -------------------------------------------------------------------------------- |
| SPIL-01                     | Done        | screens/SPIL-01-after-375.png                                                       | screens/SPIL-01-after-1280.png                                                        | pass   | CI     | CI nightly | Unit matrix (2, 3, 12 players), e2e LMGF repro, harness self-test                |
| SPIL-03                     | Done        | screens/SPIL-03-after-sheet-375.png                                                 | screens/SPIL-03-after-sheet-1280.png                                                  | pass   | CI     | CI nightly | e2e live counts (realtime), own count, force dialog hold; pgTAP for save_answers |
| SPIL-04                     | Done        | screens/SPIL-04-after-reveal-tie-375.png, screens/SPIL-04-after-results-tie-375.png | screens/SPIL-04-after-reveal-tie-1280.png, screens/SPIL-04-after-results-tie-1280.png | pass   | CI     | CI nightly | Unit tests for groups, places and T ranks; tie fixture checked at 375 and 1280   |
| SPIL-02, SPIL-05 to SPIL-33 | Not started |                                                                                     |                                                                                       |        |        |            |                                                                                  |

## SPIL-01: Softlock after "Move on without them"

- [x] LMGF repro (2 players, host moves on without the guest) reaches "Lights down" and the reveal with no extra tap: `tests/e2e/softlock.spec.ts`, both phones within 10 s of the guest locking.
- [x] A player with no targets sees "Everyone else sat out this round.", never a blank screen, also after a reload.
- [x] Reloading any client lands on a working screen: every state load runs `advancePhaseIfReady`, which heals a room waiting on nobody.
- [x] The host sees "Skip to the reveal" 60 s into guessing. The server enforces the same 60 s (`TOO_EARLY` before).
- [x] `advancePhaseIfReady` is safe concurrently: locks only fill empty timestamps, and `advance_room` takes a row lock and rejects a phase the room already left. It runs after answer submit, guess submit, force, leave, admin removal and every state load (which covers reconnect). Answer and guess saves do not change readiness, so they do not call it.

Notes:

- Before: the host's guess screen rendered nothing (`GuessView` returned null with zero targets). The `guess` screen is unchanged for players who have targets.
- The spec also shows the skip button "whenever every connected player is locked or has no targets". Auto-lock covers the second half. A disconnected guesser is covered by "Move on without them" and the 60 s skip, so presence is not a server rule.
- In guessing, the room now waits for players who sat out answering (they can still guess), as the spec's ready rule asks.

Admin cascade (screens/SPIL-01-admin-rooms-375.png, screens/SPIL-01-admin-rooms-1280.png):

- [x] Rooms: a "Stuck" tag and filter chip for rooms in answering, guessing or Lights down with no change for 20 minutes (`isStuck`, unit tested).
- [x] Rooms: "Force advance" on live rooms, `POST /admin/rooms/:id/advance`. It runs the same server code as the host's "Move on without them" (`forceAdvance`). Close already existed.
- [x] Role check: new permission `rooms.advance` for owner and moderator (matrix test updated). Audit entry `room_advanced` ("Forced a room on") with the phase before and after. e2e: `tests/e2e/admin-rooms.spec.ts`.
- No new tables, so "Reset all data" needs no change.

## SPIL-03: Live answer progress is stale

- [x] The host sees the guest's count change within 1 s per answer in realtime mode (`tests/e2e/progress.spec.ts` checks each of 3 answers within 2 s, end to end through the database). Polling mode: the 5 s poll carries `answered` and `lastAnswerAt` per player.
- [x] Own count is always right: it comes from this phone's saved and queued answers, so it moves on the tap, before any server echo.
- [x] The force dialog shows "{answered}/{total} · last answer {n}s ago" live, and holds the confirm button for 3 s ("They're still going…") when someone answered in the last 5 s.
- [x] Grey "Offline" chip after 10 s out of presence, in the side panel and the waiting list (realtime only; polling has no presence).

Notes:

- Counts are written in the same transaction as the answers (`save_answers`), then broadcast as a small `progress` event that phones patch in place; no full refetch per answer.
- The offline queue sends batches, and each batch produces one progress event with the final count.
- Migration 20261024000900, applied to staging on 2026-10-24. See docs/MIGRATIONS.md.

## SPIL-04: Ties ranked as if one player spilled more

- [x] Two equal scores are revealed together with the tied kicker: LXQT (both 40) is one step, "Tied for most spilled". Two tied players sit side by side (vessels 300 px on phones, 360 px on desktop, 12 px gap); three or more scroll sideways with snap.
- [x] No copy implies an order between equal scores: reveal kickers use the tie keys, the results list shows "T1, T1, 3", the winner line uses winnerTie, and the group card says "{names} tied for the win."
- [x] Group card and results use the same ranks (both from `rankByGuessing`, with the same T labels).

Notes:

- The spec says "dense ranking" but gives `1 + count(score > mine)` and "T1, T1, 3", which is competition ranking. The examples win (docs/ARCHITECTURE_NOTES.md section 5).
- The server returns `spillRank` and `tiedWith` per result row; the reveal groups come from the pure `spillGroups` in lib/game.
- Award tie-breaks still follow SRS 4.3 (earliest submit wins a tied award); that is a product rule, not a ranking, so it is unchanged.
