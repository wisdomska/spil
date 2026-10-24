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

| Ticket             | Status      | 375 px                        | 1280 px                        | Chrome | Safari | Firefox    | QA sign-off                                                       |
| ------------------ | ----------- | ----------------------------- | ------------------------------ | ------ | ------ | ---------- | ----------------------------------------------------------------- |
| SPIL-01            | Done        | screens/SPIL-01-after-375.png | screens/SPIL-01-after-1280.png | pass   | CI     | CI nightly | Unit matrix (2, 3, 12 players), e2e LMGF repro, harness self-test |
| SPIL-02 to SPIL-33 | Not started |                               |                                |        |        |            |                                                                   |

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
