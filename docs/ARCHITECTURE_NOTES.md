# Architecture notes

A working map of the SPIL codebase for the fix handoff (docs/SPIL_Fix_Handoff.md). Written in
Phase 0, against `main` at v1.4.0. Section 3 confirms or corrects the spec's section 0.3
("Codebase landmarks").

## 1. Stack

- Next.js 16 App Router (Turbopack, Cache Components, `proxy.ts` instead of middleware), React 19,
  TypeScript strict, Tailwind v4 with the design tokens in `app/styles/tokens.css`,
  `spil-theme.css` and `spil-extras.css` (no hex values in `app/` or `components/`).
- Radix primitives (Dialog, Tabs, Switch, RadioGroup, ToggleGroup, DropdownMenu), Motion
  (`motion/react`), Phosphor icons (`XxxIcon`), TanStack Query, zustand.
- Supabase: Postgres with RLS on every table, anonymous auth (players), password auth (admins),
  Realtime private channels. All writes go through route handlers with the service role.
- Hosting: Vercel (production `main`, staging `preview`), Supabase projects `spil-prod` and
  `spil-preview`. See docs/OPERATIONS.md.

## 2. Map

### Routes (app/)

| Route                                            | File                                                                        | Notes                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/`                                              | `app/page.tsx`                                                              | Landing, `HeroDemo` (drag demo), `ShareDemo`, `SiteFooter`          |
| `/create`                                        | `app/create/page.tsx` → `CreateRoom.tsx` → `components/game/PackPicker.tsx` | Pack picker; also handles `?room=…&mode=pack                        | rematch` |
| `/join`                                          | `app/join/page.tsx` → `JoinForm.tsx`                                        | Code entry, `CodeInput`                                             |
| `/r/[code]`                                      | `app/r/[code]/page.tsx` → `components/room/RoomApp.tsx`                     | Whole game: lobby, question, waiting, guess, ready, reveal, results |
| `/r/[code]/me`                                   | `app/r/[code]/me/page.tsx` → `ProfileForm.tsx`                              | Nickname, face, 18+ checkbox today; error states via `ErrorScreen`  |
| `/how-to-play`, `/privacy`, `/terms`, `/contact` | `app/*/page.tsx` + `components/site/InfoPage.tsx`                           | Help pages with the shared tab bar                                  |
| `/admin/login`, `/admin/reset`                   | `components/admin/LoginForm.tsx`, `ResetForm.tsx`                           |                                                                     |
| `/admin` (console)                               | `app/admin/(console)/*` + `components/admin/ConsoleShell.tsx`, `sections/*` | Overview, Rooms, Packs, Questions, Reports, Inbox, Audit, Settings  |
| `/dev/screens/[screen]`, `/dev/kitchen-sink`     | `app/dev/*`                                                                 | Fixture screens for visual tests; 404 in production (`APP_ENV`)     |
| `/og`, `/og/r/[code]`                            | `lib/og.tsx`                                                                | Link-preview images                                                 |

### Room screens (components/room/)

`RoomApp.tsx` picks the screen from server state (`state.room.status`, `me.status`, submit
times): `LobbyView`, `QuestionView` (swipe/keys, offline queue), `WaitingView` (progress list,
nudge, "Move on without them" sheet), `GuessView` (one `ScoreSlider` per target), `ReadyView`
("Lights down"), `components/game/RevealStage.tsx` (client-timed ceremony from
`lib/room/revealTimeline.ts`), `ResultsView` (tabs Scores, Awards, Questions; Spill Mode switch;
share; rematch). `RoomShell.tsx` is the frame (desktop sidebar with code, players, presence).

### API (app/api/v1/), all wrapped by `lib/api/handler.ts` `route()`

Player: `POST /rooms` (create, Turnstile), `GET /rooms/{code}` (public summary), `POST
/rooms/{code}/join`, `GET /rooms/{code}/state` (also the 30 s heartbeat and host hand-over),
`PUT /answers` + `POST /answers/submit`, `PUT /guesses` + `POST /guesses/submit`, `POST /start`,
`POST /advance` (host: answering→guessing, guessing→ready with sat-out marking; ready→revealed
finalizes), `POST /pack` (lobby pack switch), `POST /rematch`, `POST /confirm-age`, `POST /kick`,
`DELETE|PATCH /me` (leave, Spill Mode, card options), `POST /nudge`, `POST /test-players`,
`GET /packs`, `POST /reports`, `POST /messages` (contact, Turnstile). Ops: `GET /api/health`,
`GET /api/version`, `GET /api/cron/expire`.

Admin (`/api/v1/admin/*`): login, logout, reset, me, me/password, admins, overview, counts,
rooms (+ close), packs, questions (+ import/export CSV), reports, messages, audit, settings,
flags, reset-data. Role checks in `lib/admin/roles.ts` via `requireAdmin(request, permission)`;
every write calls `audit()` (`lib/admin/server.ts`).

### Server logic (lib/)

- `lib/game/*`: pure rules with ~99.6% coverage: `scoring.ts` (Spill Score, skip limit 10%),
  `results.ts` (`computeResults`: rows, question stats, ranking by guessing points since v1.4.0,
  `rankByGuessing`), `awards.ts` (`pickAwards`, SRS 4.3 rules), `phases.ts` (`canStart`,
  `nextHost`, `rematch`, `unfinishedPlayers`, `isRoomExpired`), `labels.ts`, `draw.ts`, `codes.ts`.
- `lib/api/rooms.ts`: `requireMember`, `requireHost`, `requirePhase`, `heartbeat`, `finalize`
  (calls SQL `save_results`), `buildState`, `freshState`, `autoplayBots`.
- `lib/flags.ts` (settings + flags, 15 s cache), `lib/ratelimit.ts` (SQL `check_rate_limit`),
  `lib/turnstile.ts` (siteverify; skipped when no secret), `lib/validation/schemas.ts` (zod).
- Client: `lib/room/useRoom.ts` (TanStack Query state, 30 s / 5 s refetch), `lib/room/answerQueue.ts`
  (zustand `persist` to sessionStorage, offline queue), `lib/realtime/useRoomChannel.ts`
  (private channel `room:{id}`, presence, broadcast → refetch, polling fallback), `lib/share/*`
  (card capture), `lib/analytics/*` (PostHog, memory persistence).

### Database (supabase/migrations 0100–0800)

- Enums: `pack_status`, `heat_level ('spicy','explicit','intense')`, `pack_tone`, `q_status`,
  `room_status ('lobby','answering','guessing','ready','revealed','closed')`,
  `player_status ('active','left','removed','sat_out')`, `answer_value`, `report_*`,
  `message_status`, `admin_role ('owner','content_lead','moderator')`.
- Tables: `packs` (`is_adult` + `heat`, `tone`, `region`, `status`, `sort_order`), `questions`
  (`status`, counters), `settings` (singleton: `questions_per_game` default 12, `min_players` 2,
  `max_players` 12), `feature_flags`, `rooms` (`host_player_id`, `created_by`, `round`,
  phase timestamps), `room_questions`, `players` (`age_confirmed`, `is_bot`, `status`,
  `last_seen_at`, submit times, `spill_mode`), `answers`, `guesses`, `results`, `awards`,
  `reports`, `messages`, `admins`, `audit_log`, `rate_limits`, `stats_daily`, `pack_plays`.
- Functions: `start_round`, `advance_room`, `save_results` (idempotent finalize), `record_join`,
  `nudge`, `check_rate_limit`, `expire_rooms`, `is_admin`, `is_room_member`, `current_player_ids`,
  `can_access_room_topic` (Realtime auth).
- Realtime: triggers `broadcast_room_change` (status, round, host) and `broadcast_player_change`
  send to `room:{id}`; `nudge` sends a `nudge` event. Clients treat every event as "refetch
  /state"; there is no progress event yet.

### i18n

`messages/en.json`, one file, 26 namespaces, about 850 strings, of which `admin` alone is 417.
`app/layout.tsx` passes **all** of it to `NextIntlClientProvider`, so every page (including invite
pages) serialises the admin strings. Server pages use `getTranslations`.

### Tests and CI

Vitest unit (`tests/unit`, coverage gate on `lib/game`), API integration (`tests/integration`,
local Supabase in CI), pgTAP (`supabase/tests`), Playwright e2e (`tests/e2e`: game flows, axe
in dark theme, 375 px no-sideways-scroll sweep, cross-browser `@cross`), design parity
(`tests/visual/parity.spec.ts`). Workflows: `ci.yml` (authorship, typecheck, lint, format, copy
rules, unit, build, key scan, pgTAP, API tests), `deploy.yml` (migrate, Lighthouse, headers, key
scan, smoke on staging), `nightly.yml`, `keepalive.yml`.

## 3. Spec section 0.3, confirmed or corrected

| Area               | Spec says                                                                    | Code says                                                                                                                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | App Router, Turbopack, Tailwind, Radix, motion, Phosphor                     | **Confirmed.** Next 16.4, Tailwind v4, `motion/react`.                                                                                                                                                                                                                                      |
| Auth and data      | Supabase anon sign-in, Realtime with 5 s polling fallback                    | **Confirmed.** Polling is 5 s when realtime is down or the `polling_only` flag is on; 30 s heartbeat refetch otherwise.                                                                                                                                                                     |
| State              | zustand with persist                                                         | **Partly.** zustand + `persist` (sessionStorage) is used only for the offline answer queue. Room state lives in TanStack Query; there is no global client store.                                                                                                                            |
| i18n               | ICU catalog with namespaces; whole catalog including admin in every page     | **Confirmed.** next-intl; root layout passes all 26 namespaces (admin = 417 of ~850 strings). The spec's namespace names differ from today's (e.g. `lobby`, `question`, `waiting`, `guess`, `results`, `card` exist; `create`, `help`, `room` as umbrellas do not).                         |
| Routes             | /, /create, /join, /r/[code], /r/[code]/me, help pages, admin                | **Confirmed**, plus `/dev/*` fixture routes (off in production). No `/safety` yet.                                                                                                                                                                                                          |
| API                | `POST /api/v1/rooms` 400 `CAPTCHA_FAILED`                                    | **Confirmed.** There is **no** `/rooms/{code}/summary`; the public summary is `GET /rooms/{code}` (returns pack, status, counts, `joined`, host nickname). "Move on without them" is `POST /rooms/{code}/advance` with `{from}`.                                                            |
| Bot check          | Turnstile invisible, error 600010 seen                                       | **Confirmed.** Production only (no keys on staging/previews today). Token prefetched on page load since v1.2.2; failures show `botCheck` toast since v1.2.1.                                                                                                                                |
| Game phases        | lobby, answering, waiting, guessing, lights down, reveal sub-phases, results | **Corrected.** DB `room_status` is `lobby, answering, guessing, ready, revealed, closed`. "Waiting" is a client screen (`me` submitted, room still answering/guessing). "Lights down" is `ready`. Reveal sub-phases are client-only and time-based (`revealTimeline.ts`), not server-paced. |
| Key components     | Vessel, avatar "E", share sheet with 10 targets, card renderer               | **Mostly.** `Vessel` (`level, num, height, fontSize, radius`), `Avatar` (`n, size, label`) now draws emoji, invite sheet has 11 targets plus system share (`InviteSheet`), result share sheet `ShareSheet` + `ShareCard` (story 9:16, group 1:1). Guess input is `ScoreSlider`.             |
| Admin settings     | questionsPerGame 5–100, minPlayers 2–20, maxPlayers currently 12             | **Confirmed** (default questions 12, players 2–12, max range 3–20). No skip limit, nudge cooldown, age lock or reveal settings yet.                                                                                                                                                         |
| Pack ratings       | 18+ Spicy / Explicit / Intense (age check)                                   | **Corrected.** Stored as `packs.is_adult boolean` + `packs.heat heat_level` (spicy/explicit/intense), with a check that they agree. There is no `rating` column; SPIL-02's migration must map `is_adult = true` to `min_age = 18`.                                                          |
| 18+ confirmation   | per-player tick                                                              | **Confirmed.** `players.age_confirmed`, `POST /confirm-age`, lobby `waitingAge`, profile `adult` checkbox, `canStart` checks it.                                                                                                                                                            |
| Ranking and awards | (ticket evidence predates v1.4.0)                                            | **Changed since the playtest.** v1.4.0 ranks results by Mind Reader points, re-ranks on read, follows SRS award rules (none below 3 players, Clueless from 5), and lists every question with counts hidden below 3 answers. SPIL-04, 09, 13 and 23 build on this.                           |
| Theme              | toggle strings present, no toggle                                            | **Confirmed.** `theme` namespace (7 keys) is dead since v1.1.0 (dark only); SPIL-33.                                                                                                                                                                                                        |

## 4. Where each ticket starts

| Ticket                 | Start here                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01                     | `app/api/v1/rooms/[code]/advance`, `lib/api/rooms.ts`, SQL `advance_room`, `GuessView`, `WaitingView`                                                        |
| 02                     | migrations, `players.age_confirmed`, `/confirm-age`, `ProfileForm`, `CreateRoom`, `PackPicker`, `/packs`, `/join`, `/pack`, `/rematch`, admin `PacksSection` |
| 03                     | `QuestionView`, `answerQueue.ts`, `/answers`, `useRoomChannel`, `WaitingView`, `RoomShell`                                                                   |
| 04, 11                 | `RevealStage`, `revealTimeline.ts`, `lib/game/results.ts`                                                                                                    |
| 05                     | `components/ui/Turnstile.tsx`, `CreateRoom`, `ContactForm`, `lib/turnstile.ts`                                                                               |
| 06                     | `app/terms`, `app/privacy`, new `app/safety`, `InfoPage` tabs, `SiteFooter`                                                                                  |
| 07                     | `app/layout.tsx`, `i18n/request.ts`, `messages/en.json`, route layouts                                                                                       |
| 08                     | `PackPicker`, `CreateRoom`, packs/questions schema, admin forms                                                                                              |
| 09, 12, 13, 16, 18, 23 | `lib/game/*`, `ResultsView`, `ShareCard`, `/me` (Spill Mode), `/rematch`                                                                                     |
| 10, 24                 | `GuessView`, `ScoreSlider`, `Vessel`, `HeroDemo`                                                                                                             |
| 14, 15, 25, 28, 29     | `LobbyView`, `RoomApp`, `WaitingView`, `/nudge`, `RoomShell`                                                                                                 |
| 17, 19, 21, 26         | `ProfileForm`, `/r/[code]/me/page.tsx`, `JoinForm`, `Avatar`                                                                                                 |
| 20, 27, 31             | `QuestionView`                                                                                                                                               |
| 22                     | `HeroDemo`, landing page                                                                                                                                     |
| 30, 32, 33             | `app/manifest.ts`, `app/globals.css`, `messages/en.json`                                                                                                     |

## 5. Spec notes to carry into the tickets

Conflicts or gaps between the spec and the code found in Phase 0. Each is repeated in the PR of
the ticket it affects.

| Ticket              | Note                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPIL-02             | There is no `packs.rating` column. The migration maps `is_adult = true` (with `heat` spicy, explicit or intense) to `min_age = 18`, and keeps `is_adult`/`heat` until the admin form moves to "Minimum age" in the same ticket.       |
| SPIL-02, 19         | `GET /rooms/{code}/summary` does not exist; the public summary is `GET /rooms/{code}`. SPIL-19 adds `minAge`, host avatar and phase there (or adds `/summary` as an alias).                                                           |
| SPIL-04             | The spec asks for "dense ranking" but its formula (`1 + count(score > mine)`) and examples (T1, T1, 3) are standard competition ranking. The examples win: equal values share a rank and the next rank skips.                         |
| SPIL-04, 09, 13, 23 | v1.4.0 already ranks results by Mind Reader points, follows SRS award rules and lists every question. These tickets change that behaviour further (banded points, tie groups, duo results); the spec's intent wins where they differ. |
| SPIL-09             | Points move from "average accuracy, 0 to 100" to "banded points per guess, summed, plus +3 closest bonus". The winner banner and ranking use the new total. Historic rooms keep their stored `mind_reader` values.                    |
| SPIL-11             | The reveal is client-timed today (`revealTimeline.ts`); SPIL-11 moves pacing to the server (`reveal_group_index`, `reveal_step`).                                                                                                     |
| SPIL-33             | The theme toggle was removed in v1.1.0; only the dead `theme` strings and any leftover code remain.                                                                                                                                   |
| All                 | Supabase CLI migrations are forward-only. Each migration ships with a matching rollback script in `supabase/rollbacks/`, documented in `docs/MIGRATIONS.md`.                                                                          |
