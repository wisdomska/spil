# QA report

Release candidate for v1.0.0. Run on 2026-10-23 against a local production build (`next build`
plus `next start`) backed by `spil-preview`, plus CI on every PR. Live-site checks (Lighthouse,
headers, smoke) run from `.github/workflows/deploy.yml` after each deploy.

## Summary

| Gate                                | Target                                | Result                                                       |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Typecheck, lint, format, copy rules | zero errors and warnings              | pass                                                         |
| Unit tests (Vitest)                 | all pass, `lib/game` coverage ≥ 90%   | 244 passed, 8 todo; `lib/game` 99.6% lines, 96.7% branches   |
| Design checks ported                | 37 of 37                              | 37 of 37 (`tests/unit/game/design-checks.test.ts`)           |
| Database (pgTAP)                    | all pass                              | 6 files pass in CI (schema, RLS on all 18 tables, functions) |
| API integration                     | all pass                              | 19 game + 20 admin tests pass (CI on local Supabase)         |
| E2E, mobile 390×844                 | all pass                              | 13 of 13                                                     |
| E2E, desktop 1280×800               | all pass                              | 13 of 13                                                     |
| Accessibility (axe, WCAG 2.2 AA)    | zero serious or critical, both themes | pass on 8 static routes and room screens, dark and light     |
| No sideways scroll at 375 px        | none                                  | pass on all 42 mobile design states                          |
| Design parity                       | every frame compared                  | 97 of 97 frames captured; median diff 5.2%                   |
| Service-role key in client bundle   | absent                                | absent (CI scan of `.next/static`, deploy scan of live JS)   |
| Lighthouse (mobile)                 | Perf ≥ 90, A11y/BP/SEO 100            | A11y, BP, SEO 100; Perf: see "Performance"                   |

## End-to-end scenarios (`tests/e2e`)

All on the mobile project against the production build:

1. Full game with 3 players on separate phones: answers, guesses, reveal, results, share card
   download, Spill Mode privacy, and an outsider gets 403 on the room state.
2. Rooms of 7 and 12 players finish and give all six awards.
3. Host forces the next phase; the slow player sits out but can still guess.
4. Host leaves the lobby and the next player becomes host.
5. Adult pack: joiners must confirm 18+, and a switch to an adult pack makes everyone confirm.
6. Offline answers queue on the phone and send when back online.
7. Rematch keeps the code, switches pack and starts a fresh round.
8. Accessibility sweeps (both themes), keyboard-only path with visible focus, and the 375 px
   sideways-scroll check.

Bugs found and fixed while getting these green:

- The pack picker came back stuck "loading" after leaving and returning (Next keeps a left page's
  state). Fixed for the pack picker, profile form and admin sign-in (`lib/useBusy.ts`).
- At 375 px the host's waiting screen was 90 px too wide, and a card mid-swipe made the page
  scroll sideways. The action row now wraps and the room shell clips horizontal overflow.
- Selected pack card text in light theme failed contrast (3.7:1). Now full strength.
- Test races (API players reading state before the host's Start or last answer landed) fixed in
  the helpers by waiting for the phase.

## Cross-device

The 3-player game (`@cross`) on each browser project, local production build:

| Project                   | Result                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Mobile Chromium 390×844   | pass                                                                                                               |
| Desktop Chromium 1280×800 | pass (full suite, 13 of 13)                                                                                        |
| Moto G4 (Chrome)          | pass                                                                                                               |
| iPhone 13 (WebKit)        | pass                                                                                                               |
| Desktop Edge              | pass                                                                                                               |
| Desktop Firefox           | not run locally (the Firefox binary will not start on this Windows machine); runs in the nightly workflow on Linux |

Found on the way:

- Edge: after a background sync between two answers the card jumped back to question 1 (the
  queue forgets sent answers before the room state refetches). The question screen now keeps its
  own record of this round's answers. Chrome hid this by refetching faster.
- WebKit: `upgrade-insecure-requests` in the CSP upgraded `http://localhost` assets to HTTPS
  (Chrome exempts localhost), so local production builds did not load. The directive is now only
  sent on Vercel, which serves HTTPS only.

## Design parity (`tests/visual`)

Each frame of `SPIL Screens Mobile Dark/Light` and `SPIL Screens Desktop` is screenshotted next to
the same state in the app (fixtures under `/dev/screens`, mocked API for error and profile states)
and diffed with pixelmatch (threshold 0.15).

- 97 frames: 42 mobile dark, 42 mobile light, 13 desktop.
- Median difference 5.2%; 63 frames under 10%, 89 under 20%.
- Largest (27% to 30%): pack picker, lobby, results. These follow the App design where it differs
  from the Prototype frames (spec section 2): uniform pack tiles with real question counts, the
  lobby invite row (WhatsApp, More options, Copy link) and the test-player link, and results
  header spacing. Reviewed side by side; no regressions.
- Run it: `DESIGN_URL=http://localhost:4500 pnpm test:visual` (serve `/design` on 4500); the
  nightly workflow uploads the diffs as an artifact.

## Performance

First-load JavaScript (gzip, all scripts in the HTML), measured with `scripts/measure-js.mjs`:

| Route          | Before hardening | Now    |
| -------------- | ---------------- | ------ |
| `/join`        | 366 KB           | 220 KB |
| `/how-to-play` | 298 KB           | 217 KB |
| `/r/[code]/me` | 312 KB           | 240 KB |
| `/r/[code]`    | 424 KB           | 412 KB |

About 180 KB of every page is the framework (React DOM, the RSC runtime, the router). The room
page adds Motion (swipe and reveal), Supabase Realtime and the room views. The 150 KB target for
room JS is not met: the framework alone is above it. Further cuts would mean dropping Motion from
the swipe or loading Realtime after first paint; both are listed as follow-ups.

Lighthouse, mobile, local production build (simulated throttling):

| Route          | Perf | A11y | BP  | SEO | LCP   | TBT    | CLS |
| -------------- | ---- | ---- | --- | --- | ----- | ------ | --- |
| `/`            | 74   | 100  | 100 | 100 | 4.5 s | 394 ms | 0   |
| `/join`        | 72   | 100  | 100 | 100 | 4.0 s | 283 ms | 0   |
| `/how-to-play` | 85   | 100  | 100 | 100 | 4.1 s | 149 ms | 0   |

Observed (unthrottled) LCP on the same runs is 0.26 s. On localhost every script finishes before
the first paint, so the simulation charges all of them to LCP; the deploy workflow measures the
live staging and production URLs, which is the number that counts. CLS is 0 everywhere.

## Security

- Security headers on every route: CSP, HSTS (2 years, preload), X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy, COOP. The deploy workflow fails if any is missing.
- RLS on every table with pgTAP coverage; all writes go through route handlers with the service
  role, which never reaches the browser (scanned in CI and on the live site).
- Rate limits on room creation, joins and admin sign-in; Turnstile ready (keys pending).
- Admin routes all check the role server-side; the proxy and the console layout both gate `/admin`.
- No analytics cookies: PostHog runs with memory persistence and never receives answer content.

## Not covered yet

- Lighthouse and the smoke test on the live staging URL run after this lands on `preview`.
- Production smoke test runs at release.
- Admin password sign-in and reset in a browser on staging: needs the first owner account
  (`scripts/create-owner.mjs`).
