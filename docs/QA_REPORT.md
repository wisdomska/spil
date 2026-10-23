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
| Lighthouse (mobile, live staging)   | Perf ≥ 90, A11y/BP/SEO 100            | A11y, BP, SEO 100; Perf 81 to 95 by route (see Performance)  |

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

Lighthouse, mobile, on live staging (`spil-party-preview.vercel.app`, Vercel CDN):

| Route          | Perf     | A11y | BP  | SEO | LCP (lab)    | CLS |
| -------------- | -------- | ---- | --- | --- | ------------ | --- |
| `/`            | 81 to 84 | 100  | 100 | 100 | 2.6 to 3.2 s | 0   |
| `/join`        | 90 to 95 | 100  | 100 | 100 | 2.4 to 2.8 s | 0   |
| `/how-to-play` | 86 to 93 | 100  | 100 | 100 | 2.4 to 3.4 s | 0   |

Ranges are across runs from a desktop and from GitHub runners; the simulated numbers move with
the runner's CPU. Accessibility, Best Practices and SEO are 100 everywhere and CLS is 0. The
performance target of 90 is met on `/join` and mostly on `/how-to-play`, not on the landing page
(open item 15). Two fixes made the biggest difference: the session proxy no longer runs on static
pages (time to first byte from about 950 ms to 100 ms), and the hero's idle animation no longer
re-renders React every frame.

## Security

- Security headers on every route: CSP, HSTS (2 years, preload), X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy, COOP. The deploy workflow fails if any is missing.
- RLS on every table with pgTAP coverage; all writes go through route handlers with the service
  role, which never reaches the browser (scanned in CI and on the live site).
- Rate limits on room creation, joins and admin sign-in; Turnstile ready (keys pending).
- Admin routes all check the role server-side; the proxy and the console layout both gate `/admin`.
- No analytics cookies: PostHog runs with memory persistence and never receives answer content.

## Live checks

- Staging (`spil-party-preview.vercel.app`): the deploy workflow passed on 2026-10-23: migrations,
  Lighthouse, all six security headers, no service-role key in any of the 56 live scripts, and the
  3-player smoke game on a phone-sized browser.
- Production: the same workflow runs on the release merge to `main`.
- Not covered: admin password sign-in and reset in a browser, which needs the first owner account
  (`scripts/create-owner.mjs`, open item 11).
