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

| #   | Screen                               | Viewport | Defect                                       | Fixed in                                        |
| --- | ------------------------------------ | -------- | -------------------------------------------- | ----------------------------------------------- |
| B1  | How to play, Privacy, Terms, Contact | 320 px   | Page scrolls sideways by 6 px (help tab bar) | Fixed in SPIL-06: the bar scrolls inside itself |
| B2  | Landing                              | 320 px   | Page scrolls sideways by 2 px                | SPIL-22 (landing)                               |

No other screen scrolls sideways at any viewport.

## Tickets

| Ticket             | Status      | 375 px                                                                                                                    | 1280 px                                                                                                    | Chrome | Safari | Firefox    | QA sign-off                                                                                                                                                                       |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPIL-01            | Done        | screens/SPIL-01-after-375.png                                                                                             | screens/SPIL-01-after-1280.png                                                                             | pass   | CI     | CI nightly | Unit matrix (2, 3, 12 players), e2e LMGF repro, harness self-test                                                                                                                 |
| SPIL-03            | Done        | screens/SPIL-03-after-sheet-375.png                                                                                       | screens/SPIL-03-after-sheet-1280.png                                                                       | pass   | CI     | CI nightly | e2e live counts (realtime), own count, force dialog hold; pgTAP for save_answers                                                                                                  |
| SPIL-04            | Done        | screens/SPIL-04-after-reveal-tie-375.png, screens/SPIL-04-after-results-tie-375.png                                       | screens/SPIL-04-after-reveal-tie-1280.png, screens/SPIL-04-after-results-tie-1280.png                      | pass   | CI     | CI nightly | Unit tests for groups, places and T ranks; tie fixture checked at 375 and 1280                                                                                                    |
| SPIL-02            | Done        | screens/SPIL-02-age-gate-375.png, screens/SPIL-02-picker-teen-375.png, screens/SPIL-02-blocked-375.png                    | screens/SPIL-02-age-gate-1280.png, screens/SPIL-02-picker-adult-1280.png, screens/SPIL-02-blocked-1280.png | pass   | CI     | CI nightly | Unit (bands, filter, start rule), API (create, join, pack change), e2e two contexts, privacy request scan, pgTAP                                                                  |
| SPIL-08            | Done        | screens/SPIL-08-picker-375.png, screens/SPIL-08-preview-375.png                                                           | screens/SPIL-08-selected-1280.png, screens/SPIL-08-preview-1280.png                                        | pass   | CI     | CI nightly | e2e sticky CTA at 375 x 812, single selection, preview pick, preview age check; unit CSV and roles; pgTAP                                                                         |
| SPIL-06            | Done        | screens/SPIL-06-safety-375.png, screens/SPIL-06-footer-375.png, screens/SPIL-06-tabs-320.png                              | screens/SPIL-06-safety-1280.png, screens/SPIL-06-terms-1280.png, screens/SPIL-06-footer-1280.png           | pass   | CI     | CI nightly | e2e every link from footer and tab bar, no sideways scroll at 320, spec copy; a11y route list includes /safety                                                                    |
| SPIL-05            | Done        | screens/SPIL-05-botcheck-375.png                                                                                          | screens/SPIL-05-botcheck-1280.png                                                                          | pass   | CI     | CI nightly | e2e forced refusal: inline error, toast, visible check, then the room is created; unit browser family; pgTAP                                                                      |
| SPIL-07            | Done        | n/a (no visual change)                                                                                                    | n/a                                                                                                        | pass   | CI     | CI nightly | unit scope coverage walk, CI HTML check, full desktop e2e (26 passed)                                                                                                             |
| SPIL-09            | Done        | screens/SPIL-09-results-375.png, screens/SPIL-09-explainer-375.png                                                        | screens/SPIL-09-results-1280.png, screens/SPIL-09-explainer-1280.png                                       | pass   | CI     | CI nightly | unit bands 0, 5, 6, 10, 11, 20, 21, closest bonus with ties, playtest numbers; results tests rewritten; e2e winner copy                                                           |
| SPIL-10            | Done        | screens/SPIL-10-guess-empty-375.png, screens/SPIL-10-guess-375.png                                                        | screens/SPIL-10-guess-empty-1280.png, screens/SPIL-10-guess-1280.png                                       | pass   | CI     | CI nightly | unit pointer mapping at 0, 50 and 100 %, keys, haptic ticks; e2e keyboard-only guess and lock, drag without page scroll                                                           |
| SPIL-11            | Done        | screens/SPIL-11-guess-375.png, screens/SPIL-11-label-375.png, screens/SPIL-11-beat-375.png, screens/SPIL-11-guest-375.png | screens/SPIL-11-tie-1280.png, screens/SPIL-11-award-1280.png                                               | pass   | CI     | CI nightly | unit slide model (order, top beat, 10 s minimum, stale and double taps); e2e two phones host taps Next, guest follows, double tap moves one slide; sound toggle remembered; pgTAP |
| SPIL-12 to SPIL-33 | Not started |                                                                                                                           |                                                                                                            |        |        |            |                                                                                                                                                                                   |

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

## SPIL-02: Age gate before play and age-based pack filtering

- [x] The host is asked their age before seeing any pack ("STEP 1 OF 2" on /create); guests are asked before the nickname form ("BEFORE YOU JOIN").
- [x] A 15-year-old sees exactly the five 13+ packs on /create and in the lobby picker, with no hint that others exist. The page HTML has no adult pack names: /create renders only 13+ packs on the server, and older bands fetch theirs after the age screen.
- [x] An 18+ host sees every pack, with adult packs under "After dark · 18+", last.
- [x] A 16-year-old opening an 18+ room sees "This room is playing an 18+ pack." and no player row is created (API test checks `playerCount` stays 1). The host is not told.
- [x] With a 16-year-old (or 13 to 15) in the lobby, the host's picker only offers allowed packs with "Some packs are hidden for this room.", and forcing an 18+ pack through the API returns 409 `PACK_NOT_ALLOWED`. `start_round` refuses it too.
- [x] Under 13: "SPIL is for ages 13 and up.", no retry, and the age stays locked on the device for the admin-set lock (24 h by default), so a reload still shows the blocked screen.
- [x] Exact age never leaves the device: only the band is sent (`ageBand`), state never includes a band (API test), `players.age_band` cannot be read by clients (pgTAP), and the e2e test scans every request body and URL for a numeric age.
- [x] The old 18+ sheet, the lobby "Waiting on ... to confirm 18+." status, the nickname-screen switch, `/confirm-age` and their strings are gone.

Admin cascade:

- [x] Packs: "Minimum age" select (13+ everyone, 16+, 18+ adult) replaces the rating options; the list shows a Min age column. `is_adult` follows `min_age = 18`, so the black tile rule is unchanged.
- [x] Settings: "Age lock (hours)", 1 to 168, default 24, audited with the other settings.
- [x] Flags: with "18+ packs" off, adult packs are hidden for every band (`packsForFloor`, unit tested).

Notes:

- Spec conflict: the spec gives 403 for `PACK_NOT_ALLOWED` on create and 409 on pack change. One code has one status here, so it is 409 in both places.
- Players already in an open room at release keep adult access only if they had ticked 18+. Everyone else defaults to 13 to 15 (the safe default), which can block an open adult lobby from starting until it is recreated.
- Migration 20261024001000, applied to staging on 2026-10-24.

## SPIL-08: Pack picker: sticky CTA, sections, selection state, previews

- [x] On a 375 x 812 viewport the Continue button is always visible without scrolling: the count and Continue sit in a bar stuck to the bottom (below 1024 px full width with a blur; at 1024 px and up, sticky at the bottom of the content column). e2e checks it before and after scrolling.
- [x] Only the chosen tile looks selected: every tile shares one base style (light for 13+, dark for 18+), Classic lost its orange fill and got a "Starter" pill, and the chosen tile alone has the 2 px accent ring with a 2 px offset and the check badge. e2e checks exactly one radio is checked.
- [x] Preview opens on every tile, shows 3 sample questions, a 1 to 5 spice meter and "Pick {pack}", and picking updates the picker and the Continue label.
- [x] Sections: Everyday, Life stages, After dark · 18+ (the last only for 18+ players).
- [x] Default count 10, options 5 · 10 · 15 · 20 · All.

Admin cascade:

- [x] Packs: "Picker section" and "Spice" fields.
- [x] Questions: "Use as preview" switch in the edit dialog (writers only; moderators still only hide), a "Preview" tag in the list, and CSV columns `is_sample` (import and export) plus `min_age`, `section` and `spice` for reference in the export.
- [x] Settings: default questions per game is 10.

Notes:

- The preview endpoint checks the age band like the pack list, so a minor cannot read an adult pack's questions through the API (e2e).
- Spice values for the existing packs are a starting point (Classic 2, 9 to 5 1, After Dark 3, Between the Sheets 4, Kink Curious 4, No Limits 5, others 2); the admin can change them.
- Migration 20261024001100, applied to staging on 2026-10-24.

## SPIL-06: Minimum age, Safety page, footer links, privacy copy

- [x] All five links work from the landing footer (How to play · Safety · Privacy · Terms · Contact, one row under the credit, 14 px, 16 px gaps, wraps on phones) and from the help tab bar (How to play · Privacy · Terms · Safety · Contact). e2e clicks every one from both.
- [x] Copy matches the spec: Terms opens with "Age"; /safety has Skip anything, Report a question, Spill Mode is always optional, Hosts and Age; Privacy "What we collect" was updated in SPIL-02.

Notes:

- Baseline defect B1 is fixed here: with five tabs the bar scrolls sideways inside itself below 640 px and brings the current tab into view, so the page never scrolls sideways (e2e checks 320 px on every help page).
- The Safety page has no lede because the spec gives none; its meta description is not shown on the page.

## Step 2 QA pass (SPIL-02, 08, 06)

- Full e2e on mobile and desktop against a local production build: all pass after two test updates (the keyboard path now goes through the age screen; the offline test waits for the save instead of racing it). The age screen now takes focus on open, so the keyboard path is type and Enter.
- Accessibility: axe finds no serious or critical issues on the static routes (including /create's age screen and /safety) and room screens.
- Baseline comparison (624 screens, 12 viewports): only the expected screens changed: pack picker, /create (age screen), Privacy and Terms (copy), and the profile screens (age row, no 18+ switch). No screen scrolls sideways except the landing page at 320 px (B2, SPIL-22).

## SPIL-05: Bot-check failure is silent

- [x] A forced CAPTCHA failure shows the inline error under Continue (alert icon, 14 px, role alert), the same text as a toast, and a visible "Quick check" card above the button; completing it creates the room (`tests/e2e/botcheck.spec.ts` refuses the first request, then the test-key check passes and the room is created).
- [x] No path leaves the button spinning without feedback: every failure (bot check, rate limit, offline, pack refused, anything else) ends with a message, and no token within 5 s shows the visible check instead of submitting an empty token.
- [x] Admin dashboard shows "Bot check failures" for the last 7 days.

Notes:

- Same handling on the contact form, the other endpoint that checks Turnstile. Joining a room does not use Turnstile.
- Failures are logged to `captcha_events` with Cloudflare's error codes, the hostname and the browser family only (no IP, no user agent).
- Owner step (Cloudflare dashboard): the production widget must list spil-party.vercel.app. Preview and local use Cloudflare's test keys, so they need no hostnames. A spike on the new tile usually means a hostname is missing.

## SPIL-07: Split the message catalog per route

- [x] No admin string appears in any public page HTML: `scripts/check-public-html.mjs` fetches /, /create, /join, /r/TEST, /r/TEST/me, /how-to-play, /contact and /safety and fails on admin keys (dangerBody, auditNote, flagSaved). It runs in CI after the app starts.
- [x] Landing page HTML size drops: before and after, from the local production build:

| Page         | Before       | After        |
| ------------ | ------------ | ------------ |
| /            | 82,502 bytes | 52,089 bytes |
| /create      | 58,154       | 28,196       |
| /join        | 54,163       | 21,670       |
| /r/TEST      | 54,393       | 28,133       |
| /r/TEST/me   | 55,884       | 23,919       |
| /how-to-play | 64,737       | 31,438       |
| /contact     | 58,664       | 26,083       |

Notes:

- The root layout passes only `common`, `toast` and `error`. Each route wraps its client components in `IntlScope` with its own namespaces (`lib/i18n/pick.ts`). The admin console gets `admin` only inside its session gate; the sign-in and reset pages get just their sub-namespaces.
- `tests/unit/i18n-coverage.test.ts` walks each route's imports from its client entry points and fails if any namespace or key it uses is missing from that route's scope, so a missing string fails CI instead of showing a raw key.
- The dev fixture screens and kitchen sink keep the whole catalog.

## SPIL-09: Banded Mind Reader scoring and results explainer

- [x] Playtest numbers now score 9 off = 5, 15 off = 2, 20 off = 2, 30 off = 0 (unit test). Each guess is banded (exact 10, within 5 is 7, within 10 is 5, within 20 is 2, else 0), the closest guess on each target gets +3 when 3 or more people guessed it (all tied closest get it), and a player's Mind Reader points are the sum. Points are stored on each guess when the round is revealed.
- [x] Results explain points in one tap: "How points work" under the list opens the table (and a line on when the bonus applies). Rows show "Spill Score 60 · room guessed 30" and the points captioned "MIND READER"; the winner line says "Mind Reader points". Players with an exact guess get a "Bullseye" stamp by their avatar.
- [x] Landing demo verdicts match the game: within 5 "Mind reader.", within 15 "Not bad.", else "Way off." (the old "Close." band is gone). The results verdict uses the same bands.

Notes:

- The Mind Reader award reason now reads "Most Mind Reader points in the room: {n}." Awards still pick by the same rules, now on the new totals.
- Older rounds keep their stored totals (average accuracy); only rounds revealed after this release use banded points.
- Bullseye stamps during the reveal come with SPIL-11.

## SPIL-10: Vessel becomes the guess input

- [x] Guessing uses the vessel: drag anywhere on it or tap to jump (380 px tall under 640 px, 400 px above, up to 440 px wide). `touch-action: none` keeps the page still while dragging (e2e checks the scroll position across a drag).
- [x] Lock it in is unavailable until the first interaction: the liquid shows faint at 50 with a "Drag the liquid" hint and no value, so nobody anchors on 50.
- [x] Keyboard and screen reader: role slider, label "Your guess for {name}", value text "{value}, {label}" ("No guess yet" before the first touch), arrows 1, Page Up and Page Down 10, Home 0, End 100 (e2e keyboard-only guess and lock).
- [x] The label sticker rides the liquid line on the right edge; minus and plus (48 px) with "0 saint" and "100 menace" sit under the vessel; Android gets a short vibration at each multiple of 10 unless reduced motion is on.

Notes:

- The landing demo and the game share `useVesselDrag` and `lib/vessel.ts`; the old slider component is deleted.
- On phones the vessel is tall, so "Lock it in" sits in a bar stuck to the bottom (as in the pack picker) and is always reachable.

## SPIL-11: Reveal: host-paced, room guess first, rank last, ties grouped, sound

- [x] A 2-player reveal cannot finish in under 10 seconds unless the host taps Skip: Next unlocks only after each slide's verdict, and the server refuses an early Next (`TOO_EARLY`). Two groups take at least 11.9 s (unit test and e2e).
- [x] The rank never appears before the number lands: the kicker says "NEXT UP" until the stamp, which comes after the fill.
- [x] The room guess line appears before the fill: the dashed "The room guessed {n}" line is step 2, the fill step 3.
- [x] Guests stay in sync with the host: every phone renders the server's slide (`rooms.reveal_index`) and works out the step from when it began (`reveal_at`); slide changes are broadcast like any room change, so guests follow within a realtime round trip (e2e checks both phones on each slide).
- [x] Sound toggle works and is remembered on the device (e2e reloads and checks).

Notes:

- Steps per group: NEXT UP (0.8 s), the room's guess as a dashed line (1.2 s), the fill with a count-up and the pour sound (1.6 s), the label stamp with the rank (stamp sound), then "Off by {n}. {verdict}" with Bullseye stamps for exact guesses. Before the last group: "And the biggest spill of the night…" with a drumroll. Then the awards, one slide each.
- Only the host has Next (56 px, at the bottom), Auto (off by default; moves on 2.5 s after Next unlocks) and Skip; guests see "Waiting for {host}…". A double tap or an old screen moves one slide only: Next sends the slide it is on and the server ignores a stale one.
- Sounds are synthesized with Web Audio, so there are no files (well under the 30 KB budget). Browsers only allow audio after a tap; the first tap anywhere starts the audio engine.
- Reduced motion: no count-up or spring; each step appears with a 0.3 s fade.
- Edge case: a 2-player room where both scored the same is one tied slide (about 5 s), so it can end sooner than 10 s.
- For SPIL-24 (legibility): the "room guessed" tag can cross the big number when the guess is near the middle.
- Rooms revealed before this release are marked finished and never replay.

## Step 3 QA pass (SPIL-05, 07, 09, 10, 11)

- Full e2e on mobile and desktop against a local production build: 35 passed, then two fixes. (1) The reveal scrolled sideways at 375 px while a sticker's slap animation briefly grew past the edge; the reveal now clips sideways overflow. (2) The reveal test checked the 1.5 s drumroll beat too late; it now checks the host straight after the tap. Both re-run green on mobile and desktop.
- Public pages carry no admin strings (CI check) and all route copy scopes are covered (unit walk).

## Owner features (after the fix handoff)

### Solo play (owner request 2026-10-24)

- [x] A room can start with 1 player (admin minimum 1 to 20, default 1).
- [x] Cascade: with nobody else to guess about, the round goes straight from answering to Lights down (no guess screen), the reveal leaves out the room-guess line and the "Off by" verdict, and the results leave out Mind Reader points, the points explainer, the winner line and awards. The result line reads "You scored {n}. Play with friends to see how well they know you."
- Tests: unit (solo results), API (a solo room starts and lands on Lights down), e2e `tests/e2e/solo.spec.ts` (whole solo round).
- Migration 20261024001500, applied to staging.

### Room Percentage (Batch 1, game mode 1)

- [x] /create offers the game before the pack (Spill Score or Room Percentage); only built modes show, adult-only ones only for 18+ hosts. The API refuses a mode that is not built (MODE_UNAVAILABLE).
- [x] Needs 3 players: with 2 the lobby says so and Start is refused (NOT_ENOUGH_PLAYERS). The lobby shows "Game: Room Percentage".
- [x] Answering is unchanged. Guessing asks "What share of the room said yes?" for each question 3 or more people answered (fewer would give answers away), on the vessel with no label sticker, a % unit and 0% nobody / 100% everyone captions. Saved debounced; the last lock submits.
- [x] Points: the Mind Reader bands on the distance to the real share, +3 for the closest when 3 or more guessed. Results rank by those points; Dark Horse and Open Book are left out.
- [x] Reveal: one host-paced slide per scored question: the question, the real share filling the vessel, then each guess with its points, Closest and Bullseye stamps. Then the awards.
- [x] Classic rooms are unchanged (results carry no percent data).
- [x] Admin rooms table shows each room's game.
- Tests: unit `tests/unit/game/percentage.test.ts`, API (mode refused, 3 needed, question targets, scoring, reveal length), e2e `tests/e2e/percentage.spec.ts` (three phones end to end). pgTAP `13_game_modes_test.sql`.
- Migrations 20261024001600 and 20261024001700, applied to staging; production at the Batch 1 release.

### Hot Takes (Batch 1, game mode 2)

- [x] /create offers Hot Takes; choosing it lists only statement packs (Hot Takes, 36 statements, 13+), and the other games never list statement packs. The API refuses a mix both ways (PACK_NOT_ALLOWED), including pack changes and rematches.
- [x] Needs 3 players. Answering is a rating from 0 nope to 100 so true on the vessel for each statement, in private; going back shows the rating given. Progress counts ratings live on every phone. Yes or no answers are refused in this mode.
- [x] Guessing asks for the room's average on each statement 3 or more people rated (fewer would give a rating away); no % sign.
- [x] Points: the Mind Reader bands on the distance to the real average, +3 for the closest with 3 or more guessers. Only the Mind Reader and Clueless awards are given (Spill Scores mean nothing here).
- [x] Reveal: one slide per statement: "Room average {n}" fills the vessel, then each guess with points, Closest and Bullseye.
- [x] Results lead with "Your hottest take" (the statement you sat furthest from the room on, your rating and the average) and your points. No Spill Score labels, Spill Mode or share card; the Questions tab shows averages only.
- [x] Test players rate and guess in both read the room modes.
- Also fixed for Room Percentage: guesses about players are refused in read the room modes.
- Tests: unit `tests/unit/game/hotTakes.test.ts` (plus the shared core still passing `percentage.test.ts`), API (pack and mode mismatch, private ratings, progress, averages, hottest take, awards), e2e `tests/e2e/hot-takes.spec.ts` (three phones end to end). pgTAP `14_hot_takes_test.sql`. Screens checked at 375 wide: rating, reveal and results.
- Migration 20261024001800, applied to staging; production at the Batch 1 release.

### Most Likely To (Batch 1, game mode 3)

- [x] /create offers Most Likely To; it lists only prompt packs (Most Likely To, 36 light prompts, 13+). Pack tiles count statements and prompts instead of questions.
- [x] Needs 3 players. Each prompt: pick anyone still in the game except yourself; votes are secret and a new vote replaces the old one. Progress counts votes live.
- [x] No guessing phase: when the last vote is in, the room goes straight to Lights down.
- [x] Points: 10 for every vote that matched the room's pick (any of them when tied). A prompt needs 3 or more votes to count. Only the Mind Reader and Clueless awards.
- [x] Reveal: one slide per prompt: the vessel fills to the pick's share of the votes, the pick is named with "2 of 3 votes" (or tied), then everyone else who got votes with their count. Never who voted for whom; the API test checks voter ids never appear in the tallies.
- [x] Results lead with "The room says you're most likely to" and your strongest prompt, then your points. No Spill Score labels, Spill Mode, share card or points explainer; the Questions tab shows each prompt's pick and count.
- [x] Test players vote too.
- Tests: unit `tests/unit/game/mostLikely.test.ts`, API (pack mismatch, self vote refused, vote replaced, no guessing, tallies, crowned, points, no voter ids), e2e `tests/e2e/most-likely.spec.ts` (three phones end to end). pgTAP `15_most_likely_test.sql`. Screens checked at 375 wide: vote, reveal and results.
- Migration 20261024001900, applied to staging; production at the Batch 1 release.

### Red Flag, Green Flag (Batch 1, game mode 4)

- [x] /create offers Red Flag, Green Flag; it lists only scenario packs (Red Flag, Green Flag, 36 friendship and crush scenarios, 13+). Tiles count scenarios.
- [x] Needs 3 players (the plan said 2; with 2 a split would give the other player's answer away, so it follows the 3 answer privacy rule like the other modes).
- [x] Answering is the yes or no swipe, read as Green flag (right, yes) or Red flag (left, no), with GREEN and RED stamps. Offline queueing, skips and reporting work as in classic.
- [x] No guessing phase: the room goes straight to Lights down after the last swipe.
- [x] Points: 10 for every swipe on the room's side (a strict majority); an even split earns nothing. Only the Mind Reader and Clueless awards.
- [x] Reveal: one slide per scenario 3 or more answered: the vessel fills to the green share, a Green flag, Red flag or Split down the middle sticker, then "67% green, 33% red". Never who swiped what.
- [x] Results lead with "Your lone flag", the scenario you were most outnumbered on, shown only to you, or "You were in step with the room on every scenario." No Spill Score labels, Spill Mode, share card or points explainer; the Questions tab shows each split.
- Tests: unit `tests/unit/game/flags.test.ts`, API (pack mismatch, ratings refused, no guessing, splits, lone flag, points), e2e `tests/e2e/red-green.spec.ts` (three phones end to end). pgTAP `16_red_green_test.sql`. Screens checked at 375 wide: swipe, reveal and results.
- Migration 20261024002000, applied to staging; production at the Batch 1 release.

### Rank the Room (Batch 1, game mode 5)

- [x] /create offers Rank the Room; it plays the prompt packs (Most Likely To), so no new content.
- [x] Needs 3 players. Each prompt: put the whole room in order, yourself included ("Senya (you)"), top is most likely. Drag a row by its handle or use the up and down arrows (each labelled "Move {name} up"). Every phone starts a prompt from the same shuffle, so nobody anchors on the roster order. A new order replaces the old one; progress counts prompts ranked.
- [x] The API refuses an order that misses or repeats a player (INVALID_TARGET).
- [x] No guessing phase: the room goes straight to Lights down.
- [x] The room's order is each player's average position (equal averages share a place). Each ranking earns up to 10 points for how close it is to the room's order. A prompt needs 3 or more rankings. Only the Mind Reader and Clueless awards.
- [x] Reveal: one slide per prompt: the room's order lands from the bottom up and the top is stamped "Most likely". Never anyone's own ranking.
- [x] Results lead with "The room ranked you #{n} for" and the prompt the room placed you highest on, then your points. No Spill Score labels, Spill Mode, share card or points explainer; the Questions tab shows each prompt's order.
- [x] Test players rank too.
- Tests: unit `tests/unit/game/rankRoom.test.ts` (order, ties, points, best place, shared shuffle), API (incomplete and repeated orders refused, re-rank replaces, no guessing, order, points, best), e2e `tests/e2e/rank-room.spec.ts` (three phones, built with the arrow buttons). pgTAP `17_rank_room_test.sql`. Screens checked at 375 wide: ranking, reveal and results.
- Migration 20261024002100, applied to staging; production at the Batch 1 release.

### Imposter (Batch 1, game mode 6)

- [x] /create offers Imposter; it plays only pairs packs (Imposter, 30 harmless pairs, 13+). This is the one mode where answers are shown to the room: the mode card and the answering screen both say so, and no "Have you ever" pack can be played in it.
- [x] Needs 3 players. At start the server picks one active player at random as the imposter, in a table nobody can read before the reveal. The imposter is not told: their phone simply shows the alternative questions. Answers are 0 to 100 on the vessel.
- [x] Voting: everyone sees the real questions with every player's number (never the imposter's questions), then votes for anyone but themselves. A changed vote replaces the old one. Locking the vote submits.
- [x] Points: 10 for a vote for the imposter; the imposter gets 20 for escaping. A tie at the top means the room could not agree, so the imposter escapes. Only the Mind Reader award.
- [x] Reveal: two host-paced slides, the room's vote (counts only) then "The imposter was" with a Caught or Got away sticker and the questions they were asked.
- [x] Results: the imposter sees "You were the imposter" with Caught or Got away with it; everyone else sees who it was and their points. The Questions tab shows each question, the imposter's version and everyone's numbers.
- [x] Test players answer and vote.
- Tests: unit `tests/unit/game/imposter.test.ts` (caught, tie, wrong pick, self votes, board), API (exactly one phone sees other questions and no state names the imposter, the vote board hides the alternatives, self vote refused, vote replaced, caught, points, reveal length), e2e `tests/e2e/imposter.spec.ts` (three phones find the imposter by comparing questions). pgTAP `18_imposter_test.sql`. Screens checked at 375 wide: answering, vote, reveal and results.
- Migration 20261024002200, applied to staging; production at the Batch 1 release.

### Two Truths and a Spill (Batch 1, game mode 7)

- [x] /create offers Two Truths and a Spill; it plays the ordinary yes or no packs.
- [x] Answering is the usual swipe. Then each player picks their card from their own answers: two they said yes to and one they said no to. Only these three are ever shown, and the screen says so. The API checks the card against the player's real answers (INVALID_PICK otherwise).
- [x] Players without 2 yes answers and 1 no get "Not enough for a card this round" and can still spot everyone else's.
- [x] Guessing: one card at a time, three questions in a shuffled order (never marked), pick the spill. A changed spot replaces the old one.
- [x] Points: 10 for each spill spotted, 5 for each player your card fools. Only the Mind Reader and Clueless awards.
- [x] Reveal: one slide per card: the questions, then Spill and True stickers and how many picked each.
- [x] Results lead with how many your card fooled, then your points. The Questions tab shows each card.
- Tests: unit `tests/unit/game/twoTruths.test.ts`, API (card checked against answers, card needed when possible, no card allowed otherwise, cards hide the spill, own card refused, spots, points), e2e `tests/e2e/two-truths.spec.ts` (three phones, one without a card). pgTAP `19_two_truths_test.sql`. Screens checked at 375 wide: card picker, reveal and results.
- Migration 20261024002300, applied to staging; production at the Batch 1 release.

### Who Said That? (Batch 1, game mode 8, 18+ only)

- [x] Owner rules for player-written text: profanity filter, reporting, 18+ rooms only.
- [x] Only offered to 18+ hosts and only with the 18+ Who Said That? pack (30 open prompts); the API refuses it otherwise (MODE_UNAVAILABLE). At most 5 prompts per round.
- [x] Answering: a short written answer per prompt, up to 140 characters. The screen says names are revealed at the end and no links, numbers or handles. The server filter (`lib/moderation/filter.ts`, unit tested) refuses slurs, hate and threats (also spelt with numbers, symbols or spaces), refuses contact details (links, emails, phone numbers, @handles) and masks common swear words; it does not trip on words like Scunthorpe or raccoon.
- [x] Guessing: one answer at a time, everyone else's answers only, shuffled, never with an author; pick who wrote it (never yourself).
- [x] Points: 10 for each right guess, 5 for each player an answer fools. Only the Mind Reader and Clueless awards.
- [x] Reveal: one slide per prompt: every answer, then who wrote it and how many guessed right.
- [x] Results: how many you guessed right and your points. The Questions tab lists every answer and author with a Report button: a report hides the answer for everyone straight away and reaches the admin Reports queue as "Answer: ... (hidden in the room)", where the author can be removed.
- Tests: unit `tests/unit/moderation/filter.test.ts` and `tests/unit/game/whoSaid.test.ts`, API (16 to 17 refused, 5 prompts, blocked and contact answers refused, swear masked, guessing hides authors, own answer refused, scoring, report hides), e2e `tests/e2e/who-said.spec.ts` (three phones, a refused link, guesses, reveal, a report). pgTAP `20_who_said_test.sql`. Results screen checked at 375 wide.
- Migration 20261024002400, applied to staging; production at the Batch 1 release.

### Spill or Skip (Batch 1, game mode 9)

- [x] /create offers Spill or Skip; it plays the classic round with the ordinary packs (answers, guesses, reveal and results as in classic).
- [x] On the results a Spill or Skip panel lists every yes from players in Spill Mode (they chose to show their yeses) plus Skip. Players who are not in Spill Mode can never be picked; the API refuses it. Switching Spill Mode on adds that player's yeses live.
- [x] One vote per player, changeable. Votes show live on every phone. The room's pick is one clear favourite with more votes than Skip; otherwise no story.
- [x] The picked player sees "The room wants your story" and can tell it or pass; everyone sees which. Only the picked player can answer.
- Tests: unit `tests/unit/game/spillOrSkip.test.ts` (options, pick, ties, Skip wins, invalid votes), API (no options before Spill Mode, non Spill Mode player refused, pick, only the picked player answers, pass), e2e `tests/e2e/spill-or-skip.spec.ts` (three phones, vote, tell). pgTAP `21_spill_or_skip_test.sql`. Panel checked at 375 wide.
- Migration 20261024002500, applied to staging; production at the Batch 1 release.

### Batch 1 complete

All nine game modes are built, each in its own pull request stacked in order (#45 to #53): Room Percentage, Hot Takes, Most Likely To, Red Flag Green Flag, Rank the Room, Imposter, Two Truths and a Spill, Who Said That?, Spill or Skip. Migrations 1600 to 2500 are on staging. CI has not run on any of them because GitHub Actions is not starting jobs for this account (billing); they land on preview in order once it does, and production follows with the owner's go ahead.

## Batch 2: playing together

### Party Mode (big screen)

- [x] Behind the `party_mode` flag (admin console). With it on, the host sees "Party Mode: show it on a TV" in the lobby; guests do not.
- [x] Pairing makes a secret screen link once per room (24 random bytes); only the host can make it. A screen without the right token is turned away ("This screen is not paired"), and with the flag off it says Party Mode is switched off.
- [x] The screen needs no account and polls every 2 seconds (rate limited). It shows the lobby with a big room code and the join address, everyone's progress while answering and guessing, Lights down, the full reveal for every game mode (the same slides as the phones, without sound or controls), and the scores.
- [x] Privacy: the screen view is built from the room state with every per-player field removed (own answers, guesses, questions, the imposter's questions, own votes). The API test checks a yes answer never reaches the screen.
- Tests: admin integration (flag off refused, guest cannot pair, token reused, wrong token 403, no own data while answering), e2e `tests/e2e/party-mode.spec.ts` (host pairs, screen shows code and players live, unpaired screen refused). pgTAP `22_party_mode_test.sql`. TV lobby checked at 1600 by 900.
- Migration 20261024002600, applied to staging.

### Live reactions on the reveal

- [x] Every phone on the reveal has a row of six fixed emoji (😂 😱 🔥 👀 🫣 💀, the device's own emoji) above Next or the waiting line. Each has a label ("React with 🔥").
- [x] A tap floats the emoji up on every phone in the room; mine shows straight away and my echo from the channel is skipped. Reduced motion fades instead of drifting. At most 24 float at once; each lasts 2.4 seconds.
- [x] Only during the reveal and results, only the fixed emoji (the database checks too), 30 a minute per player, never stored. Reactions do not make phones reload the room.
- Tests: API (refused before the reveal, unknown emoji refused, rate limit), e2e `tests/e2e/reactions.spec.ts` (a tap on one phone shows on the other). pgTAP `23_reactions_test.sql`. Reveal with reactions checked.
- Migration 20261024002700, applied to staging.

### Daily Spill

- [x] /daily (linked from the landing page as "Today's Spill"): one question a day for everyone, from the 13+ Classic pack, walked one a day so none repeats until all have had a day. The day runs on UTC (Ghana time).
- [x] The age screen runs first (under 13 is refused, like the rest of the site). One answer per person per day, tied to their anonymous session; a second answer keeps the first.
- [x] After answering: your answer, and the share of SPIL that said yes once 10 or more answered ("The share shows once 10 people have answered" before that). Nobody's answer is ever shown.
- [x] The streak (days in a row) lives on the device only; it survives reloads and storage failures do not block answering.
- Tests: unit `tests/unit/game/daily.test.ts` (UTC days, no repeats, share threshold, streak), API (first answer kept, bad values refused, share after 10 answers, no user ids), e2e `tests/e2e/daily.spec.ts` (landing link, age, answer, streak, reload). pgTAP `24_daily_spill_test.sql`. Page checked at 375 wide.
- Migration 20261024002800, applied to staging.

### Batch 2 complete

Party Mode (#54), live reactions (#55) and the Daily Spill (#56), stacked on Batch 1.

## Batch 3: coming back

### Crews and seasons

- [x] No signup (owner decision): crews live with the device session; an invite link brings people (or a lost device) back.
- [x] After a game, the host can save the group as a crew (name through the text filter, up to 40 characters). Only the host joins; everyone else in the room is offered "Join {crew}" on their results and joins with one tap. Nobody is added without choosing.
- [x] A crew page (members only): the season table for a calendar month (Mind Reader points, rounds and wins, ties share a place), previous seasons, recent rounds, members, the invite link, "Start a game with this crew" and Leave. "Your crews" lists them, linked from the landing page.
- [x] Rounds played as the crew (a room started from the crew, or saved as one, including the round just played and rematches) keep only nicknames, Mind Reader points and ranks; never answers or Spill Scores.
- [x] Invite links show only the crew's name and size before joining; joining asks for the name the crew sees. Crews hold up to 20 members.
- Tests: unit `tests/unit/game/crews.test.ts` (season keys, members only, ties), API (host only, filter, offered not added, members only, round recorded, invite, leave, start a room as the crew), e2e `tests/e2e/crews.spec.ts` (save, a friend joins from the results, season table). pgTAP `25_crews_test.sql`. Crew page checked at 375 wide.
- Migration 20261024002900, applied to staging.

### Custom packs written by hosts

- [x] Owner rules: 18+ rooms only, profanity filter, reportable, visible only to the room that made them.
- [x] In the lobby, the host sees "Write your own questions" only when everyone in the room is 18 or older and the game plays yes or no questions. A room with a 16 to 17 player refuses it (CUSTOM_ADULTS_ONLY).
- [x] Each question is typed after "Have you ever" (typing it is fine; it is taken off), goes through the text filter (slurs and contact details refused, swear words masked) and is 8 to 120 characters. Up to 30 per room; 5 to play.
- [x] Playing them makes the room 18+ (no minor can join after), keeps them for rematches, and never lists them anywhere else: they are a hidden pack owned by the room, deleted with it, and absent from the admin pack list.
- [x] Reportable: the usual report button on the question card works; a report reaches the admin queue, where the question can be hidden.
- Tests: API (host only, filter, prefix removed, 5 needed, room becomes 18+, never listed, played, mixed ages refused), e2e `tests/e2e/custom-pack.spec.ts` (write five, refused handle, play solo, a custom question shows). pgTAP `26_custom_packs_test.sql`.
- Migrations 20261024003000 and 20261024003100, applied to staging (see the staging incident note in MIGRATIONS.md).

### Teen, seasonal and local packs

- [x] SHS Days (13+, Ghana: boarding house, prep, exeat), Exam Season (13+), Church Kid (13+) and Detty December (16+). 30 questions each, three preview samples each.
- [x] Detty December stays 16+ and keeps to parties, outfits, travel and family; no drinking (Ghana's drinking age is 18).
- [x] Age bands hold: a 13 to 15 player sees the three 13+ packs and not Detty December; 16 to 17 sees it. Checked on preview as a 15 year old (Church Kid under Everyday, SHS Days and Exam Season under Life stages).
- Tests: API (bands, preview samples). pgTAP `27_local_packs_test.sql`.
- Migration 20261024003200, applied to staging.

### Premium packs behind payments_enabled

- [x] Owner decision: free for now, no checkout. An admin can mark a pack Premium in the pack form ("Free while payments are off").
- [x] With `payments_enabled` off (today) every pack plays and nothing is shown. With it on, a premium pack shows a Premium badge and "Premium packs are coming soon", cannot be picked, and the API refuses it (PACK_PREMIUM).
- Tests: admin integration (mark premium, unlocked with payments off, locked and refused with payments on, everything restored). pgTAP `28_premium_packs_test.sql`.
- Migration 20261024003300, applied to staging.

### Achievements and cosmetics

- [x] Owner decisions: free, kept with the device session, no sign up. Thirteen badges with progress bars on "Your badges", linked from the landing page and the results.
- [x] Each finished round adds to every real player's stats (test players excepted): rounds, wins (rank 1, at least two players, some points), bullseyes, rounds hosted, Mind Reader points and distinct games played. Crews and Daily Spill answers count from their own tables.
- [x] Badges unlock four avatar frames (Ring, Accent, Dashed, Double), drawn from tokens and shown in the lobby, the room roster and the results, and two share card looks (Slate, Glow), all in the dark theme. Locked ones say which badge earns them; the API refuses a locked choice.
- Tests: unit `tests/unit/game/achievements.test.ts` (progress capped, unlocks, wins need someone to beat), API (round recorded, locked refused, frame unlocked and worn, others see it in the roster), e2e `tests/e2e/badges.spec.ts` (play solo, First Spill earned, wear Ring). pgTAP `29_achievements_test.sql`. Page checked at 375 wide.
- Migration 20261024003400, applied to staging.

## Step 4: results and UX polish (SPIL-12 to SPIL-23)

### SPIL-12: Results headline grammar per label

- [x] Each label reads as a sentence: "You're Fresh Out The Box.", "You're Mostly Innocent.", "You've Been Around.", "You're a Main Character.", "You're a Legendary Menace." The label words keep the accent colour (one ICU select with rich text).
- [x] The headline is used only on the results screen; the label sticker and reveal keep the bare label.
- Tests: unit `tests/unit/copy/headline.test.ts` (all five labels); smoke e2e matches the new headline.

### SPIL-13: Award source of truth

- [x] Cause: the share card fell back to "Open Book" whenever the player had no award (every 2-player or solo round), so the card showed a badge the Awards tab did not. Spill Mode never changed awards; the badge looked tied to it only because it was always there.
- [x] Awards come only from the server (`pickAwards` at finalize, stored in `awards`, read by the results). The story and group cards, the Awards tab and the landing page "last game" card all read that list; with no award the card renders without the badge.
- [x] The landing demo keeps its sample badge only when there is no last game.
- Tests: e2e `tests/e2e/awards-source.spec.ts` (solo round: Awards tab says awards start at 3, no award name on either card size).

### SPIL-14: "Start the game" ignores the first tap

- [x] Cause: every room action wrote its fresh state into the cache, but a state fetch already in flight (started by the lobby change just before) could land afterwards and put the lobby back. The game had started; the host's screen did not show it until the next refetch, so a second tap "worked".
- [x] Fix: actions cancel any in-flight state fetch before writing their result (`lib/room/useRoom.ts`). This covers every action (start, advance, reveal, rematch, Spill Mode), not only Start. `canStart` already came only from server state and refusals already map to toasts.
- Tests: e2e `tests/e2e/start-tap.spec.ts` (pack change, guest leaves and rejoins, one tap starts within 10 s). It failed 1 run in 3 before the fix and passed 4 of 4 after.

### SPIL-15: Tell the moved-on player what happened

- [x] When the host moves on without them, the player gets a sheet before guessing: "The host moved on." / "Your answers so far won't count this round, but you can still guess." / "Got it". It shows once per round on that phone, also after a reload.
- [x] The roster shows "Sat out" for that player instead of a count (until they lock in their guesses).
- [x] Driven by the player's own `sat_out` status in the room state rather than a separate broadcast, so a missed realtime event or a reload cannot skip it.
- Tests: e2e `tests/e2e/moved-on.spec.ts` (sheet, copy, roster, no repeat after reload).

### SPIL-16: Spill Mode confirmation, keep scroll position

- [x] Turning Spill Mode on opens "Turn on Spill Mode?" with the screenshot warning, "Spill it" and "Keep private"; focus starts on "Keep private" (new `initialFocus` on `Sheet`). Keep private leaves it off. Turning it off is instant with the existing toast.
- [x] No scroll jump: nothing in the results, switch or toast scrolls or moves focus, and the page holds its position (checked within 4 px) after Spill Mode turns on and the list updates.
- Tests: e2e `tests/e2e/spill-confirm.spec.ts`.
