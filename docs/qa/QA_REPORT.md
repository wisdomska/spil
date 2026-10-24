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

| Ticket             | Status      | 375 px | 1280 px | Chrome | Safari | Firefox | QA sign-off |
| ------------------ | ----------- | ------ | ------- | ------ | ------ | ------- | ----------- |
| SPIL-01 to SPIL-33 | Not started |        |         |        |        |         |             |
