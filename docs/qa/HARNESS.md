# QA harness

Built in Phase 0 of the fix handoff (docs/SPIL_Fix_Handoff.md, section 5.1).

## Multiplayer helpers (tests/e2e/harness.ts)

Each helper drives one browser context, which is one phone with its own anonymous Supabase
session. Viewports follow the spec: guest 375 x 812, host 1280 x 800.

| Helper                                                        | Does                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `phone(browser, "guest" \| "host")`                           | New context and page at the spec viewport                           |
| `passAgeGate(page, age)`                                      | Answers the SPIL-02 age gate when it is shown; no-op before SPIL-02 |
| `createRoom(page, { age, pack, count, nickname })`            | /create, pack, length, nickname, lobby; returns the code            |
| `joinRoom(page, code, { age, nickname })`                     | Invite link, age gate, nickname, lobby                              |
| `startGame(host)`                                             | Starts and waits for the first question                             |
| `answerAll(page, "YNYNY")`, `answerSome(page, n, pattern)`    | Keyboard answers                                                    |
| `guess(page, value)`, `lockIn(page)`, `guessAll(page, value)` | Keyboard guess (slider today, vessel after SPIL-10)                 |
| `nextReveal(host)`                                            | Taps "Next" once SPIL-11 lands; returns false before                |
| `revealAndSkip(host, guests)`                                 | Starts the reveal and skips to results on every phone               |
| `adminLogin(browser, baseURL, role)`                          | Admin console session without a password (see below)                |

`tests/e2e/harness.spec.ts` is the self-test: a 2-player game from create to results across
desktop and phone, and an admin session.

### Admin sessions

`adminLogin` signs in a fresh anonymous user, lists it in `admins` with the requested role
(`owner`, `content_lead`, `moderator`) using the service role key, and sets its session cookie in
a new context. `cleanup()` deletes the user. It needs `SUPABASE_SERVICE_ROLE_KEY` (local
`.env.local` points at staging) and refuses to run against the production project.

## Environment

- **Turnstile:** local (`.env.local`) and every Vercel preview deployment use Cloudflare's test
  keys (site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`), which
  always pass, so automated tests can create rooms. Production keeps its real keys.
- **Test players:** the `test_players` flag is on in `spil-preview` and off in `spil-prod`.

## Baseline screenshots (tests/visual/baseline.spec.ts)

Every screen at 320, 360, 375, 390, 414, 768, 1024, 1280, 1440 and 1920 px, phone landscape
(844 x 390) and 200% zoom (a 1280 x 800 window at 2x). Screens: the design-parity list (game
screens through `/dev/screens` fixtures and a mocked API), `/create`, the 404 page, and the eight
admin sections. Output: `tests/visual/baseline/<viewport>/<screen>.png` (git-ignored, large) and
`index.json`, which lists any screen that scrolls sideways.

```bash
E2E_BASE_URL=http://localhost:3100 pnpm test:baseline
```

To compare after a change, capture into another folder and diff:

```bash
BASELINE_DIR=tests/visual/baseline-after E2E_BASE_URL=http://localhost:3100 pnpm test:baseline
```

```bash
pnpm test:baseline:compare tests/visual/baseline tests/visual/baseline-after
```

The compare step writes diff images for every screen that changed by more than 1% and prints
them, so each visual change can be explained in the ticket's PR.

## Accessibility

`tests/e2e/a11y.spec.ts` runs axe (WCAG 2.2 AA tags, zero serious or critical) on the static
routes and room screens, a keyboard-only path, and a no-sideways-scroll sweep of every game
screen at 375 px. New screens from the tickets get added there.
