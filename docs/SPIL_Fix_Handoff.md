**ENGINEERING HANDOFF · FIX SPEC**

**SPIL**

Action plan for Claude Code: every fix from the UX audit and the playtest, plus the new age gate with age-based pack filtering

---

**Owner:** WISDOMSKA (Senya)

**Product:** spil-party.vercel.app

**Date:** 24 October 2026

**Sources:** SPIL UX audit (first pass, site and client review) and SPIL playtested audit (3 live games, 15 bugs).

**Tickets:** 33 (8 P0, 15 P1, 10 P2).

**Contents**

**0. Read this first**

Kickoff prompt for Claude Code, ground rules, codebase landmarks, execution order

**1. Ticket index**

All 33 tickets at a glance

**2. P0: fix before anything else**

Softlock, age gate and pack filtering, progress sync, ties, bot check, legal copy, catalog split, pack picker

**3. P1: next release**

Vessel guess, reveal, scoring, results, awards, Spill Mode, rematch, invite, answering, landing, duo

**4. P2: polish**

Digits, leave flow, avatars, taps, QR, nudge, manifest, haptics, layout

**5. Test plan and definition of done**

Playwright multiplayer setup, regression checklist

**6. Out of scope for this handoff**

Roadmap items kept for later

**0. Read this first**

**0.1 Kickoff prompt (paste into Claude Code)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr>
<td><p>You are working in the SPIL repository (Next.js App Router, Tailwind, Supabase).</p>
<p>Read the attached spec "SPIL_Fix_Handoff.docx" end to end before changing code.</p>
<p>Work ticket by ticket in the order given in section 0.4. For each ticket:</p>
<p>1. Locate the code using the grep hints in the ticket.</p>
<p>2. Restate the root cause in one paragraph before editing.</p>
<p>3. Implement the UI spec and the implementation spec exactly.</p>
<p>4. Add or update the tests listed under "Tests".</p>
<p>5. Tick every acceptance criterion; if one cannot be met, stop and explain.</p>
<p>6. Commit with message "SPIL-XX: &lt;title&gt;".</p>
<p>Rules:</p>
<p>- Commits are authored by WISDOMSKA(SENYA). Do not add Claude as author or</p>
<p>co-author and do not add any Co-Authored-By trailer.</p>
<p>- Keep SPIL's copy voice. Use the exact strings in this spec.</p>
<p>- Never log, store or send a player's exact age. Store the age band only.</p>
<p>- All new user-facing strings go into the i18n message files, not inline.</p>
<p>- Server enforces every rule the UI enforces (age, pack, phase, rate limits).</p></td>
</tr>
</tbody>
</table>

**0.2 Ground rules**

- **Attribution:** every commit is authored by WISDOMSKA(SENYA). No Claude co-author lines anywhere (commits, PRs, changelogs).

- **Server is the source of truth.** The UI hides or disables things; the API rejects them. Never rely on a disabled button for safety.

- **One ticket, one commit (or one PR).** Commit message format: SPIL-07: Vessel as the guess input.

- **Copy:** use the strings in this document verbatim. Add them under the namespace named in the ticket. Keep sentence case, no exclamation marks, no emoji in UI copy.

- **Design tokens:** reuse existing Tailwind tokens seen in production: bg-surface, bg-surface-raised, text-text, text-text-muted, text-accent, text-accent-ink, bg-accent, border-line, rounded-card, rounded-pill, rounded-input, font-display, font-mono, bg-error, bg-success. Do not introduce raw hex values.

- **Motion:** every new animation must respect prefers-reduced-motion: reduce (instant state change, no shake, no confetti).

- **Accessibility:** every interactive element has a visible focus ring, a 44 px minimum hit area and an accessible name.

- **Privacy:** exact age never leaves the device. Only the band (13_15, 16_17, 18_plus) is sent and stored.

**0.3 Codebase landmarks (observed from production)**

These were observed in the live build. File paths are not visible from production, so each ticket gives grep hints (message keys, component names, API paths) that will find the right files quickly.

| **Area**       | **What production shows**                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework      | Next.js App Router with Turbopack chunks; Tailwind utility classes; Radix-style primitives (RovingFocusGroup, Collection, Switch); motion library for animation; Phosphor icons (BookOpenIcon, DropIcon).          |
| Auth and data  | Supabase with anonymous sign-in (sb-…-auth-token cookie, is_anonymous: true). Realtime updates with a "Polling only" fallback flag (5 s).                                                                          |
| State          | zustand with persist middleware on the client.                                                                                                                                                                     |
| i18n           | ICU-style message catalog with namespaces and keys such as nudgeOne, forceBody, waitingAge, ageTitle, botCheck, headline, verdictWell. The entire catalog, including admin strings, is serialised into every page. |
| Routes         | /, /create, /join, /r/\[code\] (lobby and game), /r/\[code\]/me (nickname), /how-to-play, /privacy, /terms, /contact, admin console (sign-in, packs, questions, reports, inbox, audit, settings).                  |
| API            | POST /api/v1/rooms (create; returns 400 {"error":{"code":"CAPTCHA_FAILED"}} on bot-check failure). Other room, join, answer, guess and reveal endpoints live under /api/v1/.                                       |
| Bot check      | Cloudflare Turnstile, invisible. Error 600010 observed in some browsers.                                                                                                                                           |
| Game phases    | Lobby, answering, waiting, guessing, lights down, reveal (client sub-phases intro, count, label, beat, award, done), results.                                                                                      |
| Key components | Vessel (props level, num, height, fontSize, radius), avatar component E (props n, size, label), share sheet with 10 targets, card renderer (story 9:16, group 1:1).                                                |
| Admin settings | questionsPerGame (5 to 100), minPlayers (2 to 20), maxPlayers (currently 12). Feature flags: Polling only, 18+ packs, Test players, paid packs, Party mode.                                                        |
| Pack ratings   | Admin offers 18+ Spicy (age check), 18+ Explicit (age check), 18+ Intense (age check).                                                                                                                             |

**0.4 Execution order and dependencies**

| **Step** | **Tickets**                                                    | **Why this order**                                                                                                             |
| -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1        | SPIL-01, SPIL-03, SPIL-04                                      | Stability and fairness. The softlock ends games today.                                                                         |
| 2        | SPIL-02 (age gate + filtering), SPIL-08 (pack picker), SPIL-06 | Safety. SPIL-08 renders the filtered pack list from SPIL-02, so build them together.                                           |
| 3        | SPIL-05, SPIL-07, SPIL-09, SPIL-10, SPIL-11                    | First impression and the core loop. SPIL-09 (scoring) must land before SPIL-11 because the reveal verdict uses its thresholds. |
| 4        | SPIL-12 to SPIL-23                                             | Results and UX polish. SPIL-13 (award source) must land before SPIL-23 (duo awards).                                           |
| 5        | SPIL-24 to SPIL-33                                             | Polish and platform.                                                                                                           |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr>
<td><p><strong>Before writing code</strong></p>
<p>Set up the two-player Playwright harness described in Section 5 first. Most P0 bugs need two browser contexts to reproduce, and every P0 ticket ships with an end-to-end test that uses it.</p>
<p>Turn on the "Test players" flag in local and preview environments only, and use Cloudflare Turnstile test keys there (site key 1x00000000000000000000AA, secret 1x0000000000000000000000000000000AA).</p></td>
</tr>
</tbody>
</table>

**1. Ticket index**

| **ID**  | **Title**                                                                                  | **Prio** | **Area**       | **Size** |
| ------- | ------------------------------------------------------------------------------------------ | -------- | -------------- | -------- |
| SPIL-01 | Softlock after "Move on without them"                                                      | P0       | Game flow      | M        |
| SPIL-02 | Age gate before play + age-based pack filtering (replaces 18+ checkbox; fixes host bypass) | P0       | Safety         | L        |
| SPIL-03 | Live answer progress is stale                                                              | P0       | Realtime       | S        |
| SPIL-04 | Ties ranked as if one player spilled more                                                  | P0       | Reveal/results | S        |
| SPIL-05 | Bot-check failure is silent                                                                | P0       | Create flow    | S        |
| SPIL-06 | Minimum age, Safety page, footer links, privacy copy                                       | P0       | Legal/content  | S        |
| SPIL-07 | Split the message catalog per route (admin strings in every page)                          | P0       | Platform       | M        |
| SPIL-08 | Pack picker: sticky CTA, sections, selection state, previews                               | P0       | Create flow    | M        |
| SPIL-09 | Banded Mind Reader scoring + results explainer                                             | P1       | Game design    | M        |
| SPIL-10 | Vessel becomes the guess input                                                             | P1       | Core loop      | M        |
| SPIL-11 | Reveal: host-paced, room guess first, rank last, ties grouped, sound                       | P1       | Core loop      | L        |
| SPIL-12 | Results headline grammar per label                                                         | P1       | Copy           | XS       |
| SPIL-13 | Award source of truth (card vs tabs, Spill Mode)                                           | P1       | Results        | S        |
| SPIL-14 | "Start the game" ignores first tap after state change                                      | P1       | Lobby          | XS       |
| SPIL-15 | Tell the moved-on player what happened                                                     | P1       | Game flow      | XS       |
| SPIL-16 | Spill Mode confirmation + keep scroll position                                             | P1       | Results        | S        |
| SPIL-17 | Remember nickname and face on this device                                                  | P1       | Onboarding     | S        |
| SPIL-18 | One-tap "Same pack" rematch + series score                                                 | P1       | Retention      | M        |
| SPIL-19 | Invite page shows room context, no skeleton                                                | P1       | Join flow      | S        |
| SPIL-20 | Skips remaining + answered/skipped state on back                                           | P1       | Answering      | S        |
| SPIL-21 | Join button state + auto-submit                                                            | P1       | Join flow      | XS       |
| SPIL-22 | Landing: demo motion, sticker overlap, social proof                                        | P1       | Landing        | S        |
| SPIL-23 | Duo results for 2-player rooms                                                             | P1       | Results        | M        |
| SPIL-24 | Digits clipped by the wave in Vessel                                                       | P2       | Visual         | S        |
| SPIL-25 | Leave room lands on the wrong page                                                         | P2       | Game flow      | XS       |
| SPIL-26 | Avatar names for screen readers + safe random default                                      | P2       | A11y           | XS       |
| SPIL-27 | Dropped taps during card transition                                                        | P2       | Answering      | S        |
| SPIL-28 | QR code join in the lobby                                                                  | P2       | Lobby          | S        |
| SPIL-29 | Nudge cooldown                                                                             | P2       | Safety         | XS       |
| SPIL-30 | Web app manifest (install to home screen)                                                  | P2       | Platform       | XS       |
| SPIL-31 | Haptics on answer and guess                                                                | P2       | Feel           | XS       |
| SPIL-32 | Header width jump between pages                                                            | P2       | Layout         | XS       |
| SPIL-33 | Theme toggle: remove dead strings                                                          | P2       | Cleanup        | XS       |

Size: XS under 2 hours, S half a day, M 1 to 2 days, L 3 to 5 days.

**2. P0: fix before anything else**

**SPIL-01 Softlock after "Move on without them"**

**Evidence (playtest, room LMGF):** 2-player room. Host finished answering; guest answered 2 of 5; host tapped "Move on without them" and confirmed. The guest moved to guessing and locked a guess, then showed "Waiting on Senya Test. Typical." The host saw an empty guessing screen with no slider and no button. Reloading did not help. The room stayed stuck after the guest left.

**Root cause (to confirm):** the host's guess targets were empty (the only other player sat out), so the guess UI rendered nothing and the host was never marked "locked". The phase advance waits for every player to lock.

**UI spec**

- If a player has zero guess targets, never render an empty screen. Show a state card in the guessing slot:

| **Element**      | **Spec**                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kicker           | NOTHING TO GUESS in font-mono text-\[13px\] text-text-muted (same style as "Guess 1 of 1").                                                                                                    |
| Title            | "Everyone else sat out this round." font-display text-display-m.                                                                                                                               |
| Body             | "Your score still counts. The reveal starts when the others lock in." text-\[15px\] text-text-muted.                                                                                           |
| Status row       | Check icon + "Locked in" chip (reuse lockedIn key). Sidebar shows "Locked".                                                                                                                    |
| Host-only action | Secondary button "Skip to the reveal" (icon: FastForward) shown to the host whenever every connected player is either locked or has no targets, and as an escape hatch after 60 s in guessing. |

**Implementation**

- **Grep:** forceBody, forceBodyGuessing, force, Guess {n} of {total} (count in the guessing namespace), the guessing screen component, and the server handler behind "Move on without them".

- Create one idempotent server function advancePhaseIfReady(roomId) and call it after every state-changing request (answer, finish answering, guess, lock, force move-on, leave, kick, reconnect) and when any client loads the room.

- Define guess targets on the server: targets(p) = players where id != p.id and status not in (sat_out, left) and answeredAll = true. A player with targets.length === 0 is auto-locked when the guessing phase starts and whenever targets change.

- Ready rule for guessing: every player whose status is not left is locked (auto-locked counts). If, after force moves, fewer than 1 player has a score, skip guessing and go to results with the existing copy for empty rounds.

- Leaving or being kicked during guessing removes that player from everyone's targets, then calls advancePhaseIfReady.

- Add host endpoint POST /api/v1/rooms/{code}/skip-to-reveal: host-only, allowed in guessing; auto-locks remaining players with the guesses they have; transitions to "lights down".

- Client: the guessing screen reads me.targets. If empty, render the state card above and never an empty container. Add a dev-mode console.error if any phase component renders no children.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr>
<td><p>// server (pseudo-TypeScript)</p>
<p>export async function advancePhaseIfReady(roomId: string) {</p>
<p>return db.tx(async (tx) =&gt; {</p>
<p>const room = await tx.rooms.lockForUpdate(roomId); // SELECT ... FOR UPDATE</p>
<p>const players = await tx.players.active(roomId); // status != 'left'</p>
<p>if (room.phase === 'answering') {</p>
<p>if (players.every(p =&gt; p.finished || p.status === 'sat_out'))</p>
<p>return tx.rooms.setPhase(roomId, 'guessing');</p>
<p>}</p>
<p>if (room.phase === 'guessing') {</p>
<p>for (const p of players) {</p>
<p>const targets = players.filter(q =&gt; q.id !== p.id &amp;&amp; q.status !== 'sat_out' &amp;&amp; q.finished);</p>
<p>if (targets.length === 0 &amp;&amp; !p.guessLocked) await tx.players.lockGuesses(p.id);</p>
<p>}</p>
<p>const fresh = await tx.players.active(roomId);</p>
<p>if (fresh.every(p =&gt; p.guessLocked)) return tx.rooms.setPhase(roomId, 'lights_down');</p>
<p>}</p>
<p>});</p>
<p>}</p></td>
</tr>
</tbody>
</table>

**Acceptance criteria**

- [ ] The playtest repro (2 players, host moves on without the guest) reaches "Lights down" and the reveal without any extra tap.

- [ ] A player with no targets sees the "Everyone else sat out this round." card, never a blank screen.

- [ ] Reloading any client in any phase lands on a working screen.

- [ ] The host sees "Skip to the reveal" after 60 s in guessing and it works.

- [ ] advancePhaseIfReady is safe to call concurrently (row lock or advisory lock) and is called after every mutation listed above.

**Tests**

- Unit: advancePhaseIfReady matrix for 2, 3 and 12 players with combinations of finished, sat_out, left, locked.

- E2E (two contexts): reproduce LMGF; assert both reach results within 10 s.

- E2E: guest leaves during guessing; host proceeds.

**SPIL-02 Age gate before play + age-based pack filtering**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr>
<td><p><strong>Requested by the owner</strong></p>
<p>Before a game starts, every player enters their age. The age decides which packs they can see and which rooms they can join. This replaces today's per-player "I'm 18 or older" tick and fixes the playtest bug where the host switched to an 18+ pack without ever being asked.</p></td>
</tr>
</tbody>
</table>

**Rules**

| **Rule**                        | **Detail**                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who is asked                    | Every player: the host before the pack picker, every guest before the nickname form. Asked once per device, then remembered (see Storage).                                                                                                                                                        |
| Age bands                       | under_13 (blocked), 13_15, 16_17, 18_plus. Only the band is sent to the server.                                                                                                                                                                                                                   |
| Pack minimum age                | New column packs.min_age with allowed values 13, 16, 18. Mapping for current packs: Classic, Campus Life, 9 to 5, Group Chat, Passport Stamps = 13. After Dark, Between the Sheets, Kink Curious, No Limits, The Purity 100 = 18. (16 is reserved for future packs such as Red Flag, Green Flag.) |
| What a player sees              | Pack picker lists only packs where min_age \<= floor(band) (13, 16 or 18). Under-18 players never see adult pack names, descriptions, counts or locked tiles.                                                                                                                                     |
| Room age floor                  | rooms.min_age = packs.min_age of the selected pack. A player whose band floor is below it cannot join.                                                                                                                                                                                            |
| Changing pack in the lobby      | Host sees only packs allowed for the youngest band in the room. The server rejects anything else.                                                                                                                                                                                                 |
| Joining an 18+ room as under 18 | Blocked with a friendly screen (copy below). The host is never told the guest's age.                                                                                                                                                                                                              |
| Feature flag                    | If the admin "18+ packs" flag is off, adult packs are hidden for everyone (current behaviour, keep).                                                                                                                                                                                              |

**UI spec: age screen**

New screen component AgeGate. Rendered as the first step on /create and on /r/\[code\]/me when the device has no valid stored band.

| **Element**       | **Spec**                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout            | Same shell as "What should we call you?": centred column max-w-\[440px\], top padding 24 px under the header, 16 px side gutters on mobile.                                                                                                                                                                                                                                                                                      |
| Kicker            | STEP 1 OF 2 (host) or BEFORE YOU JOIN (guest), font-mono text-\[13px\] text-text-muted.                                                                                                                                                                                                                                                                                                                                          |
| Title             | "How old are you?" font-display text-display-m.                                                                                                                                                                                                                                                                                                                                                                                  |
| Helper            | "We use this to show packs that fit you. We only keep your age group, never your exact age." text-\[15px\] text-text-muted.                                                                                                                                                                                                                                                                                                      |
| Input             | Single field, label "Your age" (visible, text-\[14px\] font-semibold). \<input type="text" inputmode="numeric" pattern="\[0-9\]\*" maxlength="2" autocomplete="off"\>. Large centred digits: font-display text-\[56px\] leading-none, height 96 px, rounded-input border border-line bg-surface-raised, focus ring ring-2 ring-accent. Placeholder empty. No default value, no slider, no "18" hint anywhere (neutral age gate). |
| Validation        | Digits only (strip others on input). Empty: CTA disabled. 0 or more than 99: inline error "Enter your real age." in text-error text-\[14px\] with an alert icon, role="alert".                                                                                                                                                                                                                                                   |
| CTA               | Full-width primary pill "Continue", height 56 px. Enter key submits.                                                                                                                                                                                                                                                                                                                                                             |
| Privacy line      | Lock icon + "No signup. Your age group stays on this device and in this room only." under the CTA, text-\[14px\] text-text-muted.                                                                                                                                                                                                                                                                                                |
| Under 13 result   | Replace the form with a full-height state: sticker "Not yet" (existing sticker style), title "SPIL is for ages 13 and up.", body "Come back when you're 13. We'll keep the scores warm.", single button "Back home". No retry link.                                                                                                                                                                                              |
| Returning players | If a valid band is stored, skip the screen. On the pack picker and the nickname screen show a small text row under the title: "Playing as 18+ · Not you?" (band label: "13 to 15", "16 to 17", "18+"). "Not you?" clears the stored band and reopens the age screen, unless the device lock is active (see Storage), in which case the link is hidden.                                                                           |

**UI spec: filtered pack picker**

- Under 18: show only allowed packs. No "After dark" section, no locked tiles, no mention that more packs exist.

- 18+: allowed packs grouped as in SPIL-08, with adult packs in a section titled "After dark · 18+" placed last.

- Lobby "Change pack" for a mixed-age room: show only packs allowed for the youngest band, plus one muted line at the top: "Some packs are hidden for this room." Never name who caused it.

- Remove the old per-player 18+ sheet ("This room is now 18+", keys ageTitle, ageBody, ageConfirm) and the lobby status "Waiting on {names} to confirm 18+." (key waitingAge), and the nickname-screen checkbox ("I'm 18 or older", keys adult, adultBody). The age gate replaces all of them.

**UI spec: blocked join**

| **Element** | **Spec**                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Where       | Instead of the nickname form on /r/\[code\]/me, and as the result of a 403 from join.                               |
| Sticker     | "18+ room" (same sticker component as "No room here").                                                              |
| Title       | "This room is playing an 18+ pack."                                                                                 |
| Body        | "Ask the host to switch packs, or start your own room."                                                             |
| Buttons     | Primary "Start a room" (goes to /create, age already known, so straight to the pack picker). Secondary "Back home". |
| Privacy     | The host and other players get no notification and no log entry naming the blocked person.                          |

**Implementation**

**Grep:** adult, adultBody, ageTitle, ageBody, ageConfirm, waitingAge, ageFirst, badgeExplicit, badgeIntense, "18+ Spicy (age check)", POST /api/v1/rooms, the join handler, the change-pack handler, the pack-list query used by /create.

**1. Database migration (Supabase SQL):**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr>
<td><p>-- packs: minimum age</p>
<p>alter table packs add column if not exists min_age smallint not null default 13</p>
<p>check (min_age in (13, 16, 18));</p>
<p>update packs set min_age = 18</p>
<p>where rating in ('spicy','explicit','intense'); -- adapt to the real rating column</p>
<p>-- players: age band only, never exact age</p>
<p>create type age_band as enum ('13_15', '16_17', '18_plus');</p>
<p>alter table players add column if not exists age_band age_band not null default '13_15';</p>
<p>-- rooms: cached floor of the selected pack</p>
<p>alter table rooms add column if not exists min_age smallint not null default 13;</p>
<p>-- helper</p>
<p>create or replace function band_floor(b age_band) returns smallint</p>
<p>language sql immutable as $$</p>
<p>select case b when '13_15' then 13 when '16_17' then 16 else 18 end</p>
<p>$$;</p></td>
</tr>
</tbody>
</table>

Default 13_15 is the safe fallback for any existing or malformed row. Update RLS so a client can never write age_band on another player's row, and can never update its own band upward after joining a room (bands are set by the join and create endpoints only, with the service role).

**2. Client storage:**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr>
<td><p>// lib/age.ts</p>
<p>export type AgeBand = '13_15' | '16_17' | '18_plus';</p>
<p>export function toBand(age: number): AgeBand | 'under_13' {</p>
<p>if (age &lt; 13) return 'under_13';</p>
<p>if (age &lt;= 15) return '13_15';</p>
<p>if (age &lt;= 17) return '16_17';</p>
<p>return '18_plus';</p>
<p>}</p>
<p>// localStorage key "spil.age" = { band, setAt } (never the number)</p>
<p>// localStorage key "spil.ageLock" = { band, until } set when band is under_13,</p>
<p>// 13_15 or 16_17; while until &gt; now the stored band cannot be changed</p>
<p>// ("Not you?" is hidden). Lock length: 24 hours.</p>
<p>// Wrap every localStorage access in try/catch; if storage is unavailable,</p>
<p>// ask every time and keep the band in memory (zustand, not persisted).</p></td>
</tr>
</tbody>
</table>

**3. API changes:**

| **Endpoint**                     | **Change**                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /api/v1/packs?band=…         | Returns only packs with min_age \<= band_floor(band) (and the 18+ flag). Never returns adult packs for lower bands. The create page and the lobby picker both use this. For the lobby, the server ignores the query param and uses the room's youngest band. |
| POST /api/v1/rooms               | Body adds ageBand. Reject under_13 (403 AGE_TOO_YOUNG). Reject a pack whose min_age exceeds the band floor (403 PACK_NOT_ALLOWED). Store band on the host player row. Set rooms.min_age.                                                                     |
| Join (nickname submit)           | Body adds ageBand. If band_floor(ageBand) \< rooms.min_age return 403 AGE_RESTRICTED and do not create a player row. Otherwise store the band.                                                                                                               |
| Change pack (lobby and rematch)  | Reject if min_age \> min(band_floor(players.age_band)) with 409 PACK_NOT_ALLOWED. On success update rooms.min_age.                                                                                                                                           |
| GET /api/v1/rooms/{code}/summary | Add minAge so the invite page can show the blocked state before the form (SPIL-19).                                                                                                                                                                          |

**4. Remove the old confirmation flow:** delete the 18+ confirm sheet, the waitingAge lobby state, the nickname-screen checkbox and the server-side "confirmed adult" field and checks. Keep the strings out of the catalog.

**5. Admin:** in the pack form, replace the rating options with a single "Minimum age" select: "13+ (everyone)", "16+", "18+ (adult)". Keep the existing tile colour rule ("18+ packs are black"). Show the minimum age as a badge on each pack tile: 13+ hidden, 16+ neutral badge, 18+ uses the existing red badge.

**6. Copy updates:** Privacy "What we collect" becomes: "A nickname, the avatar you pick, your age group (13 to 15, 16 to 17 or 18+), your answers and your guesses, all tied to one room. No email, no phone number, no contacts, and never your exact age."

**Acceptance criteria**

- [ ] Host is asked their age before seeing any pack. Guests are asked before the nickname form.

- [ ] A 15-year-old sees exactly the five 13+ packs and no hint that others exist, on /create and in the lobby picker.

- [ ] An 18+ host sees all packs; adult packs sit under "After dark · 18+".

- [ ] A 16-year-old opening the invite to an 18+ room sees "This room is playing an 18+ pack." and no player row is created.

- [ ] With a 16-year-old in the lobby, the host cannot select or API-force an 18+ pack (409).

- [ ] Under 13: blocked screen, and re-entering a different age on the same device within 24 h is not possible.

- [ ] Exact age never appears in network payloads, logs, the database or analytics (verify with a grep of request bodies in tests).

- [ ] All old 18+ confirmation UI and the waitingAge status are gone.

**Tests**

- Unit: toBand boundaries 12, 13, 15, 16, 17, 18, 99; pack filter by band.

- API: create with under_13, create 13_15 + adult pack, join adult room as 16_17, change pack with a minor present.

- E2E: two contexts (18+ host, 15 guest) cover filtering, blocked join and lobby picker.

- Privacy test: intercept all requests during the flow and assert no numeric age field is ever sent.

**SPIL-03 Live answer progress is stale**

**Evidence:** while answering, the host sidebar showed "Kwame 0/5" while Kwame was on question 3, and the host's own row showed 0/5 while the host was on question 3. The "Move on without them?" dialog also showed 0/5, so the host decides on wrong data.

**UI spec**

- Sidebar rows, the waiting list and the force dialog show live answered/total within 1 s of each answer.

- Your own row updates instantly from local state (optimistic), never waits for the server echo.

- If a player has been disconnected for more than 10 s, show a grey "Offline" chip next to their count (the presence dot already exists).

- In the "Move on without them?" dialog, each row shows "{answered}/{total} · last answer {n}s ago". If a player answered in the last 5 s, the confirm button is disabled for 3 s with the label "They're still going…".

**Implementation**

- **Grep:** the sidebar list that renders 0/5, Questions answered (progress), queued, saving, the answer submit function and the realtime channel subscription.

- Persist players.answered_count (or compute from answers) and update it in the same transaction as each answer insert.

- Broadcast on the room channel after each answer: {type: "progress", playerId, answered, at} (Supabase Realtime broadcast). Subscribers patch their store; no full refetch.

- Polling fallback: include answered and lastAnswerAt per player in the room poll payload.

- Offline queue: when answers flush, send one progress event with the final count.

**Acceptance criteria**

- [ ] Host sees the guest's count change within 1 s per answer in realtime mode and within 5 s in polling mode.

- [ ] Own count is always correct.

- [ ] Force dialog shows the live count and the 3-second protection.

**SPIL-04 Ties ranked as if one player spilled more**

**Evidence (room LXQT):** both players scored 40. The reveal labelled Esi "2nd most spilled" and Ama "Spilled the most".

**UI spec**

- Use dense ranking for Spill Scores and for Mind Reader points (equal values share a rank).

- Reveal: tied players are revealed in one step. Layout: 2 tied players side by side (two vessels, each height 300 on mobile, 360 desktop, 12 px gap); 3 or more in a horizontally scrollable row with snap. Kicker: "Tied for most spilled" or "Tied for {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} most spilled".

- Results list: tied rows show the same rank number with a small "T" prefix (T1, T1, 3).

- Winner banner when Mind Reader points tie: reuse winnerTie ("{names} tied for the win with {points} guessing points.").

**Implementation**

- **Grep:** top ("Spilled the most"), place (selectordinal), winnerTie, the sort that produces reveal order.

- Compute rank = 1 + count(players with score \> mine) server-side; return rank and tiedWith: playerId\[\] per player. Reveal steps are groups, ordered from lowest to highest score.

- New keys (reveal namespace): tieTop: "Tied for most spilled", tiePlace: "Tied for {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} most spilled".

**Acceptance criteria**

- [ ] Two equal scores are revealed together with the tied kicker.

- [ ] No copy ever implies an order between equal scores.

- [ ] Group card and results use the same ranks.

**SPIL-05 Bot-check failure is silent**

**Evidence:** in one browser every "Continue" on /create returned 400 CAPTCHA_FAILED ("Complete the bot check."). Console showed Turnstile error 600010. The button spun and reset with no message. The app already has the copy (botCheck).

**UI spec**

- Inline error under the Continue button: alert icon + message, text-error text-\[14px\], role="alert", 8 px gap below the button. Also fire a toast with the same text.

- Message map: CAPTCHA_FAILED → botCheck ("We couldn't confirm you're a person. Try again, or turn off your VPN if you use one."); RATE_LIMITED → rateLimited; network error → offline; anything else → somethingWrong.

- After a CAPTCHA failure, show the Turnstile widget visibly in a card above the CTA ("Quick check" label) so the person can complete an interactive challenge. Button label stays "Continue with {pack}".

- Apply the same handling to every endpoint that verifies Turnstile (create, join if applicable, contact form).

**Implementation**

- **Grep:** botCheck, CAPTCHA_FAILED, turnstile, cf-turnstile, challenges.cloudflare.com.

- Render Turnstile with appearance: "interaction-only" (managed) when the pack picker mounts; store the token; refresh on expired-callback; on error-callback set state needsInteraction.

- On Continue: if no token yet, await it for up to 5 s, then submit. Never submit with an empty token.

- Server: when siteverify fails, log error-codes and hostname to a captcha_events table (no IP, no user agent beyond browser family) and include the count in the admin dashboard next to "Games today".

- Cloudflare dashboard: add every production and preview hostname to the widget (spil-party.vercel.app and the preview pattern). Use test keys in local and preview.

**Acceptance criteria**

- [ ] A forced CAPTCHA failure shows the inline error, the toast and a visible challenge; completing it creates the room.

- [ ] No path leaves the button spinning without feedback.

- [ ] Admin dashboard shows CAPTCHA failures for the last 7 days.

**SPIL-06 Minimum age, Safety page, footer links, privacy copy**

**UI spec**

- **Terms:** add a first section. Heading "Age". Body: "You must be 13 or older to play SPIL. Packs marked 18+ are only shown to players who tell us they are 18 or older. Do not invite anyone under 18 into an 18+ room."

- **Safety page:** new route /safety, added as a fifth tab in the help pages tab bar (How to play · Privacy · Terms · Safety · Contact). Sections: "Skip anything" ("Every player has skips. Use them. Nobody sees which questions you skipped."), "Report a question" ("Tap the flag on any card. We review every report."), "Spill Mode is always optional" ("Your answers stay private unless you turn it on. You can turn it off any time, but people may have seen them already."), "Hosts" ("Hosts can remove players and move on without slow players. Hosts can't see anyone's answers or age."), "Age" (same text as Terms).

- **Landing footer:** one row under the existing "Designed & Developed by Senya": links How to play · Safety · Privacy · Terms · Contact, text-\[14px\] text-text-muted hover:text-text, 16 px gaps, wraps on mobile.

- **Privacy:** update "What we collect" as in SPIL-02 step 6.

**Acceptance criteria**

- [ ] All five links work from the landing footer and the help tab bar.

- [ ] Copy matches this spec exactly.

**SPIL-07 Split the message catalog per route**

**Evidence:** every public page (including invite pages) serialises roughly 570 strings, including the admin console: sign-in, password reset, roles, feature flags, "Reset all data", audit log labels.

**Implementation**

- **Grep:** the i18n provider in the root layout (NextIntlClientProvider or equivalent) and the messages loader.

- Split messages into namespaces: common, landing, create, join, room (lobby, answering, waiting, guessing, reveal, results, card), help (how to play, privacy, terms, safety, contact), admin.

- Root layout passes only common. Each route segment layout wraps its children with a provider that receives only the namespaces it needs (for example /r/\[code\] gets common + room).

- The admin layout is the only place that loads admin, and only after the admin session check.

- Add a CI check: build, fetch /, /create, /join, /r/TEST HTML and fail if it contains any admin key (for example dangerBody, auditNote, flagSaved).

**Acceptance criteria**

- [ ] No admin string appears in any public page HTML.

- [ ] Landing page HTML size drops (record before and after in the PR).

**SPIL-08 Pack picker: sticky CTA, sections, selection state, previews**

**Evidence:** on phones the question count and "Continue" sit below all packs. Classic is always solid orange, so it looks selected even when Group Chat has the check. Tiles describe the vibe but not the content.

**UI spec**

| **Element**                | **Spec**                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sections                   | "Everyday" (Classic, Group Chat), "Life stages" (Campus Life, 9 to 5, Passport Stamps), "After dark · 18+" (18+ band only, see SPIL-02). Section titles text-\[14px\] font-semibold text-text-muted uppercase tracking-wide, 24 px above, 12 px below.                                                                                                           |
| Tiles                      | All tiles share one base style (light tile for 13+, dark tile for 18+ as today). Classic loses its permanent orange fill and gets a small "Starter" pill instead.                                                                                                                                                                                                |
| Selected state             | 2 px ring-accent + 2 px offset, the existing check badge top-right, and aria-checked="true" on the radio. Exactly one tile looks selected.                                                                                                                                                                                                                       |
| Preview                    | Text button "Preview" (Eye icon, 14 px) at the bottom-left of each tile. Opens a bottom sheet (mobile) or dialog (desktop): title "{pack}", three sample questions as "Have you ever…" cards, a spice meter (1 to 5 drops using DropIcon, filled text-accent), and a primary "Pick {pack}" button.                                                               |
| Sticky bar (below 1024 px) | position: sticky; bottom: 0, full width, bg-surface/90 backdrop-blur border-t border-line, padding 12 px 16px plus env(safe-area-inset-bottom). Contents: the minutes line ("About 2 minutes of answering.") in text-\[13px\] text-text-muted, the segmented count control (5 · 10 · 15 · 20 · All {n}), then the full-width CTA "Continue with {pack}" (56 px). |
| Desktop (1024 px and up)   | Keep the current inline layout but make the count + CTA block sticky at the bottom of the viewport.                                                                                                                                                                                                                                                              |
| Default count              | 10 (change the admin default questionsPerGame to 10).                                                                                                                                                                                                                                                                                                            |

**Implementation**

- **Grep:** Pick your poison. (create namespace title), howMany, continue, aboutPack, howItWorks, the Classic tile variant.

- Packs table: add spice smallint check (spice between 1 and 5) and section text check (section in ('everyday','life','after_dark')). Questions table: add is_sample boolean default false; preview uses up to 3 is_sample questions, else the first 3 by order.

- Admin pack form: fields "Section", "Spice (1 to 5)"; question list: "Use as preview" toggle.

- Sections and filtering come from the same GET /api/v1/packs?band= response as SPIL-02.

**Acceptance criteria**

- [ ] On a 375 × 812 viewport the CTA is always visible without scrolling.

- [ ] Only the chosen tile looks selected.

- [ ] Preview opens, shows 3 questions and selecting from it updates the picker.

**3. P1: next release**

**SPIL-09 Banded Mind Reader scoring + results explainer**

**Evidence:** points appear to be 100 minus the error: 9 off = 91, 15 off = 85, 20 off = 80, 30 off = 70. Everyone scores 70 to 100, a lazy 50 guarantees at least 50, and "They have no idea" sits next to 70 points. Each results row shows "Spill Score 60 · the room guessed 30" and "91 PTS" with no explanation.

**UI spec**

| **Element**   | **Spec**                                                                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Results row   | Left: rank (T1 style for ties), avatar 40 px, name, label pill. Under the name: "Spill Score 60 · room guessed 30" in font-mono text-\[13px\] text-text-muted. Right: points in font-mono text-\[30px\] with caption "MIND READER" (text-\[11px\] tracking-wide). |
| Explainer     | Text button under the list: "How points work" (Info icon). Opens a sheet with a 5-row table: "Exact: 10", "Within 5: 7", "Within 10: 5", "Within 20: 2", "More than 20: 0", plus "Closest in the room: +3".                                                       |
| Stamps        | During the reveal (SPIL-11) and on results, a guess that is exact shows a "Bullseye" stamp next to the guesser's avatar.                                                                                                                                          |
| Winner banner | "You won the round with {points} Mind Reader points." (update winner, winnerYou, winnerTie to say "Mind Reader points").                                                                                                                                          |

**Implementation**

- **Grep:** guessed, winner, winnerYou, winnerTie, PTS, the scoring function on the server.

- Replace the scoring function. Store points per guess row so history is stable.

- Align verdict copy thresholds with the bands: diff ≤ 5 → verdictWell / verdictMind; ≤ 15 → verdictLittle / verdictNotBad; else verdictNone / verdictOff. Use the same thresholds on the landing demo.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr>
<td><p>export function mindReaderPoints(diff: number): number {</p>
<p>if (diff === 0) return 10;</p>
<p>if (diff &lt;= 5) return 7;</p>
<p>if (diff &lt;= 10) return 5;</p>
<p>if (diff &lt;= 20) return 2;</p>
<p>return 0;</p>
<p>}</p>
<p>// closest bonus: for each target, every guesser with the minimum diff gets +3</p>
<p>// (only when 3+ guessers guessed that target, so 2-player rooms stay fair)</p></td>
</tr>
</tbody>
</table>

**Acceptance criteria**

- [ ] Playtest numbers now score 9 off = 5, 15 off = 2, 20 off = 2, 30 off = 0.

- [ ] Results explain points in one tap.

- [ ] Landing demo verdicts match the in-game thresholds.

**Tests**

- Unit: band boundaries 0, 5, 6, 10, 11, 20, 21; closest bonus with ties.

**SPIL-10 Vessel becomes the guess input**

**Evidence:** the landing page sells a liquid you drag up and down; the game uses a plain range slider starting at 50. The vessel only appears on the waiting screen, reveal and cards.

**UI spec**

| **Element**   | **Spec**                                                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout        | Replace the horizontal slider with the Vessel. Height 380 px on screens under 640 px, 400 px above. Full content width (max 440 px). Number centred on the liquid (see SPIL-24 for legibility).                                  |
| Interaction   | Drag anywhere on the vessel vertically: level = clamp(round(100 - y / height \* 100), 0, 100). Tap jumps the level to that point. touch-action: none on the vessel so the page does not scroll while dragging.                   |
| Initial state | No value. Liquid shown at 50 with 40 % opacity, a "Drag the liquid" hint chip (Hand icon) centred, and "Lock it in" disabled. First interaction sets the value and removes the hint. This removes the 50 anchoring seen in play. |
| Label sticker | The live label (e.g. "Main Character") sits on the right edge at the liquid line and moves with it.                                                                                                                              |
| Fine controls | Keep the minus and plus round buttons (48 px) under the vessel, plus "0 saint" and "100 menace" captions.                                                                                                                        |
| Keyboard      | The vessel is role="slider" with aria-valuemin=0, aria-valuemax=100, aria-valuenow, aria-valuetext="{value}, {label}" (key valueText), label "Your guess for {name}". Arrows ±1, PageUp/PageDown ±10, Home 0, End 100.           |
| Haptics       | navigator.vibrate?.(5) each time the value crosses a multiple of 10 (Android only; skip when reduced motion is on).                                                                                                              |

**Implementation**

- **Grep:** Lock it in (lock), lower, raise, saint, menace, valueText, Vessel, and the landing demo drag code (captionAsk, Drag).

- Extract the landing demo's drag logic into useVesselDrag(ref, {value, onChange}) and reuse it in both places.

- Wrap in GuessVessel component; the old slider component is deleted.

**Acceptance criteria**

- [ ] Guessing on a phone uses the vessel; the page does not scroll while dragging.

- [ ] Lock it in is disabled until the first interaction.

- [ ] Keyboard and screen reader behaviour match the spec.

**Tests**

- Component test: pointer drag maps to values at 0 %, 50 %, 100 % of height.

- E2E: keyboard-only guess and lock.

**SPIL-11 Reveal: host-paced, room guess first, rank last, ties grouped, sound**

**Evidence:** each score filled in about 3 seconds and auto-advanced; a 2-player reveal was over in 6 seconds. "2nd most spilled" appeared above the empty vessel, so the result was known before the number landed.

**UI spec**

| **Element**                 | **Spec**                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Step 1 · Intro (0.8 s)      | Avatar 56 px + name. Kicker "NEXT UP" (not the rank). Counter "REVEAL {n} OF {total}" stays.                                                                                                                       |
| Step 2 · Room guess (1.2 s) | A dashed horizontal line appears on the empty vessel at the room's average guess, with a tag on the left: "The room guessed {guess}".                                                                              |
| Step 3 · Fill (1.6 s)       | Liquid rises from 0 to the real score with ease-out-cubic and a count-up number. Pour sound.                                                                                                                       |
| Step 4 · Stamp              | Label sticker springs in (existing sticker), then the rank kicker replaces "NEXT UP": "2nd most spilled", "Spilled the most", or the tie keys from SPIL-04. Stamp sound.                                           |
| Step 5 · Verdict            | Line under the vessel: "Off by {diff}. {verdict}" using the SPIL-09 thresholds.                                                                                                                                    |
| Advance                     | Host sees a full-width primary button "Next" (56 px) fixed to the bottom. Guests see "Waiting for {host}…" in its place. A small "Auto" toggle in the host header (off by default) advances 2.5 s after the stamp. |
| Top spiller beat            | Before the last group, a 1.5 s interstitial: "And the biggest spill of the night…" font-display text-display-m, drumroll sound.                                                                                    |
| Sound                       | Header speaker toggle (Speaker / SpeakerSlash icons), default on, remembered per device. Three sounds: pour, stamp, drumroll. Each 30 KB or less, preloaded after the first user gesture.                          |
| Reduced motion              | No count-up or springs: show the final state per step with 0.3 s fades.                                                                                                                                            |

**Implementation**

- **Grep:** counter ("REVEAL {n} OF {total}"), guessed, top, place, announce, and client phases intro, count, label, beat, award, done.

- Server stores reveal_group_index and reveal_step with updated_at. Host "Next" calls POST /api/v1/rooms/{code}/reveal/next with the expected current index (ignore stale or double taps). All clients render from server state, so phones stay in sync.

- Insert a guess sub-phase between intro and count. Reuse beat for the top-spiller interstitial.

- Keep the host-only "Skip" to jump to results.

- Groups come from SPIL-04 (ties).

**Acceptance criteria**

- [ ] A 2-player reveal cannot finish in under 10 seconds unless the host taps Skip.

- [ ] The rank never appears before the number lands.

- [ ] The room guess line appears before the fill.

- [ ] Guests stay in sync with the host within 500 ms.

- [ ] Sound toggle works and is remembered.

**Tests**

- E2E: two contexts, host taps Next through all groups; guest text matches each step.

- Double-tap Next advances only one group.

**SPIL-12 Results headline grammar per label**

**Evidence:** "You're a Been Around." and "You're a Mostly Innocent."

**UI spec**

- Headline per label, with the label words in text-accent-ink:

- "You're Fresh Out The Box." · "You're Mostly Innocent." · "You've Been Around." · "You're a Main Character." · "You're a Legendary Menace."

**Implementation**

- **Grep:** headline ("You're a") in the results namespace.

- Replace with an ICU select: "headline": "{label, select, fresh {You're \<em\>Fresh Out The Box\</em\>.} innocent {You're \<em\>Mostly Innocent\</em\>.} around {You've \<em\>Been Around\</em\>.} main {You're a \<em\>Main Character\</em\>.} other {You're a \<em\>Legendary Menace\</em\>.}}" rendered with rich text so \<em\> maps to the accent span.

**Acceptance criteria**

- [ ] All five labels read correctly on results and anywhere else the headline is reused.

**SPIL-13 Award source of truth (card vs tabs, Spill Mode)**

**Evidence:** in a 2-player game the story card showed an "Open Book" badge while the Awards tab said "Awards start at 3 players." The badge stayed after Spill Mode was turned off.

**UI spec**

- When no awards apply, the story card renders without the award badge (layout re-centres; no empty circle).

- When Spill Mode changes, the card preview and the Awards tab update within 1 s.

**Implementation**

- **Grep:** openBook, awardsNone, awardLine, card renderer, results query.

- One server function computeAwards(roomId) used by the Awards tab, the story card, the group card and the share image route. No award logic on the client.

- Invalidate the results query (and any cached card image) on spill_mode_changed broadcast.

**Acceptance criteria**

- [ ] 2-player games never show an award anywhere (until SPIL-23 adds duo awards through the same function).

- [ ] Toggling Spill Mode updates awards and card consistently.

**SPIL-14 "Start the game" ignores the first tap after a state change**

**Evidence:** right after the guest confirmed 18+, the host tapped "Start the game" once and nothing happened; a second tap worked.

**UI spec**

- One tap always starts the game when the status line says "{n} in. Everyone ready?".

- If the server refuses, show the reason as a toast (needPlayersProd, ageFirst replacement from SPIL-02, or somethingWrong).

**Implementation**

- **Grep:** Start the game (start), softDisabled, ready, need.

- Derive canStart only from the subscribed server room state, not a local flag set before the update arrived. Remove any debounce that swallows the first click.

- The start endpoint returns a reason code; map it to the toast.

**Acceptance criteria**

- [ ] E2E: change pack, have the guest rejoin, tap Start once, game starts.

**SPIL-15 Tell the moved-on player what happened**

**Evidence:** after "Move on without them", the guest jumped from question 3 to guessing with no explanation.

**UI spec**

| **Element** | **Spec**                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sheet       | Bottom sheet on the moved-on player's device: title "The host moved on.", body "Your answers so far won't count this round, but you can still guess.", button "Got it". |
| Sidebar     | That player's row shows "Sat out" (existing satOut key) instead of a count.                                                                                             |

**Implementation**

- Broadcast player_moved_on with the player id; the matching client opens the sheet once.

**Acceptance criteria**

- [ ] The moved-on player always sees the sheet before the guessing screen.

**SPIL-16 Spill Mode confirmation + keep scroll position**

**Evidence:** Spill Mode turns on instantly and the page jumps to the bottom of the questions list.

**UI spec**

| **Element** | **Spec**                                                                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Turning on  | Dialog: title "Turn on Spill Mode?", body "Everyone in this room will see your yes and no answers next to your name. People can screenshot, so only turn it on if you're comfortable.", buttons "Spill it" (primary) and "Keep private" (secondary). Focus starts on "Keep private". |
| Turning off | Instant, with the existing toast.                                                                                                                                                                                                                                                    |
| Scroll      | The page keeps its scroll position when the list updates.                                                                                                                                                                                                                            |

**Implementation**

- **Grep:** spillMode, spillOn, spillOff, spillOnCopy.

- Wrap the switch: intercept onCheckedChange(true) to open the dialog. Stable keys on question rows; remove any scrollIntoView or autofocus triggered by the toast.

**Acceptance criteria**

- [ ] Turning on always asks first; turning off never asks.

- [ ] No scroll jump.

**SPIL-17 Remember nickname and face on this device**

**Evidence:** the host retyped the nickname for every new room.

**UI spec**

- The nickname field is prefilled with the last name used on this device, and the last face is selected. A text link "Not you?" next to the label clears both.

**Implementation**

- localStorage spil.profile = {nickname, avatar} written on successful join or create. Wrap in try/catch.

- Duplicate-name errors still apply (errTaken).

**Acceptance criteria**

- [ ] Second room on the same device needs zero typing to join.

**SPIL-18 One-tap "Same pack" rematch + series score**

**Evidence:** rematch sends the host back through the full pack picker, and scores reset every game.

**UI spec**

| **Element**          | **Spec**                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host results actions | Primary "Rematch" (same pack, same count, one tap, no picker) and secondary "Change pack". Guests keep "{host} can start a rematch".                          |
| Series strip         | From the second game in a room, a strip above the tabs: "Series · Ama 2 · Esi 1" (round wins by Mind Reader points). Tied rounds give each tied player a win. |
| Reset                | Text button "Reset series" for the host, in the strip.                                                                                                        |

**Implementation**

- **Grep:** rematch, guestRematch, onlyHostRematch, /create?room=…&mode=rematch.

- Add POST /api/v1/rooms/{code}/rematch with {samePack: true}; it validates the pack against the youngest band (SPIL-02).

- Add rooms.series_round and a series_wins JSON or table keyed by player id; increment on results.

**Acceptance criteria**

- [ ] Rematch with the same pack takes one tap.

- [ ] Series strip shows correct wins across 3 games.

**SPIL-19 Invite page shows room context, no skeleton**

**Evidence:** opening an invite link showed a grey skeleton for about 6 seconds, then a nickname form with no indication of whose room or which pack.

**UI spec**

| **Element** | **Spec**                                                                                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header card | Above the age gate and nickname form: host avatar 40 px, "Joining {host}'s room", and "{pack} · {n} in" in text-text-muted. If the room is 18+ and the device band is lower, go straight to the blocked state from SPIL-02. |
| Loading     | Server-render this card; no client skeleton for the first paint.                                                                                                                                                            |

**Implementation**

- Make /r/\[code\]/me a server component that fetches GET /rooms/{code}/summary (host nickname, avatar, pack name, player count, min age, phase) in one query.

- Keep the existing "No room here", "Dried up", "Too late" and "Full house" states.

**Acceptance criteria**

- [ ] First paint of an invite link shows the header card.

- [ ] Largest contentful paint under 2.5 s on a throttled 4G profile.

**SPIL-20 Skips remaining + answered/skipped state when going back**

**Evidence:** Skip moves on silently, and the limit is only explained once used up. Going back to a skipped card shows no state.

**UI spec**

| **Element**    | **Spec**                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Skip button    | Label "Skip · {n} left". At 0: disabled (aria-disabled), label "No skips left", tooltip with skipLimit.                                                |
| Revisited card | Chip top-right of the card: "You said Yes", "You said No" or "Skipped". The matching button shows a pressed state (aria-pressed="true", filled style). |

**Implementation**

- **Grep:** skip, skipAria, skipLimit, previous.

- Skip limit comes from the server room settings; keep the count in the answering store.

**Acceptance criteria**

- [ ] Players always know how many skips remain.

- [ ] Back navigation shows prior answers.

**SPIL-21 Join button state + auto-submit**

**Evidence:** the Join button still looks disabled after 4 characters until tapped.

**UI spec**

- As soon as 4 valid characters are present (typed or pasted), the button switches to the filled accent style and the code submits automatically after 150 ms. Errors keep the current copy.

**Implementation**

- **Grep:** Got a code? (join title), paste, submit, invalid.

**Acceptance criteria**

- [ ] Typing or pasting a valid code joins without pressing the button.

**SPIL-22 Landing: demo motion, sticker overlap, social proof**

**Evidence:** the demo vessel drifts on its own (37, 38, 68 between screenshots) while asking you to drag it; the "Main Character" sticker and the "You" pill overlap the demo's Reveal button; no social proof.

**UI spec**

- The idle wobble stops on the first pointer down and never restarts; until then a pulsing "Drag me" chip sits on the vessel.

- Move the "You" pill to the top-right corner of the phone frame and keep the label sticker on the left edge at the liquid line; both pointer-events: none and never overlapping the Reveal button (minimum 12 px clearance).

- Under the hero CTAs: "{n} rooms spilled this week" with a small pulsing dot, hidden when n is below 50.

**Implementation**

- Add GET /api/v1/stats/public returning finished rooms in the last 7 days, cached 10 minutes at the edge.

**Acceptance criteria**

- [ ] No decorative element overlaps a tap target at 375 px or 1280 px.

- [ ] Counter shows and hides correctly.

**SPIL-23 Duo results for 2-player rooms**

**Evidence:** in 2-player games the Awards tab is empty, every question count is hidden and the group card is half empty.

**UI spec**

| **Element** | **Spec**                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tabs        | For exactly 2 scored players, tabs are "Scores" and "Duo" (Awards and Questions are hidden).                                                                                                                                                     |
| Duo tab     | Big number: "How well you know each other: {pct}%" where pct = 100 minus the average of both guess errors. One duo award: "Soulmates" (both within 5), "Getting there" (both within 15), "Work in progress" (otherwise), with a one-line reason. |
| Group card  | Duo layout: both vessels side by side, the duo award and the percentage.                                                                                                                                                                         |

**Implementation**

- Duo awards come from computeAwards (SPIL-13) when the scored player count is 2.

**Acceptance criteria**

- [ ] A 2-player game never shows an empty tab.

- [ ] The group card has no empty half.

**4. P2: polish**

**SPIL-24 Digits clipped by the wave in Vessel**

**Evidence:** the top of the numbers is hidden behind the wave crest on the waiting vessel ("1/2"), the reveal and the share card ("60"). The number is rendered twice (light and dark copies), and screen readers read it twice.

**UI spec**

- Numbers are always fully legible: the light copy sits above the empty area, the dark copy is clipped to the liquid using the same wave path as the crest, and the crest bubbles never paint over either copy.

**Implementation**

- **Grep:** Vessel.

- Z-order: liquid fill, then crest, then the two number layers. Build the dark copy's clip-path from the same SVG path as the crest (including bubbles).

- Mark the dark copy aria-hidden="true".

**Acceptance criteria**

- [ ] Values 0, 1/2, 50, 60, 100 are fully readable at every height used (136, 300, 380, 400).

- [ ] Screen readers announce the number once.

**SPIL-25 Leave room lands on the wrong page**

**Evidence:** a guest who left mid-game landed on the nickname form with "You left the room." even though they cannot rejoin.

**UI spec**

- After leaving, go to / and show the toast "You left the room." On the landing page, focus moves to "Start a room".

**Implementation**

- **Grep:** leftRoom, leaveInGame, leaveLobby.

- router.replace('/') after a successful leave; keep the lobby case (rejoin allowed) unchanged.

**Acceptance criteria**

- [ ] Leaving in game always lands on the home page.

**SPIL-26 Avatar names for screen readers + safe random default**

**Evidence:** avatars are announced as "Avatar 1" to "Avatar 24"; the random default face can be the clown or the sweaty "hot face".

**UI spec**

- Each face has a name: Devil, Smirk, Giggle, See no evil, Cowboy, Party, Cool, Zany, Cheeky, Shush, Angel, Hot face, Mind blown, Woozy, Ghost, Alien, Clown, Skull, Nerd, Cat, Frog, Fox, Panda, Unicorn.

- Random default never picks Clown, Skull or Hot face. In rooms whose youngest band is under 18, Hot face is not offered.

**Implementation**

- **Grep:** avatar ("Avatar {n}"), face ("Pick your face").

- Change the key to "avatar": "Avatar: {name}" and add a names map.

**Acceptance criteria**

- [ ] Screen readers announce "Avatar: Ghost".

- [ ] Random default is always from the safe list.

**SPIL-27 Dropped taps during card transition**

**Evidence:** answering at roughly 1.8-second intervals, about one tap in five did not register (needs confirmation on a real phone).

**UI spec**

- A tap during the card exit animation is never lost: it is applied to the next card as soon as it is ready, or ignored only if it would answer the same card twice.

**Implementation**

- **Grep:** the answer handler guarded by aria-disabled during the transition.

- Keep a single-slot queue for the pending answer; reduce the input lock to 250 ms or less.

**Acceptance criteria**

- [ ] Ten rapid taps at 300 ms spacing record ten answers in order.

**SPIL-28 QR code join in the lobby**

**Evidence:** on desktop the room code appears twice (sidebar and main); people in the same room still have to type it.

**UI spec**

- Desktop lobby: replace the large duplicate code in the main column with a 168 px QR code on a white rounded card, caption "Scan to join", code still in the sidebar.

- Mobile lobby: secondary button "Show QR" (QrCode icon) opens a sheet with a full-width QR and the code below.

**Implementation**

- Generate SVG with the qrcode package from the invite URL (/r/{code}). No external QR service.

**Acceptance criteria**

- [ ] Scanning the QR opens the invite page for that room.

**SPIL-29 Nudge cooldown**

**Evidence:** nudges have no visible limit and could be used to pile on a slow player.

**UI spec**

- After a nudge, the button reads "Nudge again in {s}s" (counting down from 20) and is disabled.

**Implementation**

- Server enforces one nudge per target per 20 s (429 with rateLimited).

**Acceptance criteria**

- [ ] Spamming the button sends at most one nudge per 20 s.

**SPIL-30 Web app manifest (install to home screen)**

**UI spec**

- "Add to Home Screen" shows the SPIL icon and opens full screen with the dark background.

**Implementation**

- Add app/manifest.ts: name "SPIL", short_name "SPIL", start_url "/", display "standalone", background and theme colours from the existing bg-surface token, icons 192 and 512 px including a maskable variant.

**Acceptance criteria**

- [ ] Lighthouse PWA installability passes.

**SPIL-31 Haptics on answer and guess**

**UI spec**

- A 10 ms vibration when an answer is committed and when "Lock it in" succeeds (Android only, skipped with reduced motion).

**Implementation**

- Small haptic(ms) helper guarding navigator.vibrate.

**Acceptance criteria**

- [ ] No errors on iOS or desktop.

**SPIL-32 Header width jump between pages**

**Evidence:** the header bar shifts width on short pages such as /join (no scrollbar) compared with long pages.

**UI spec**

- The header never moves between pages.

**Implementation**

- Add scrollbar-gutter: stable to html in global CSS.

**Acceptance criteria**

- [ ] Navigating between /, /join and /create causes no horizontal shift.

**SPIL-33 Theme toggle: remove dead strings**

**Evidence:** toLight, toDark and menu ("Choose theme") exist in the catalog but no toggle is rendered.

**UI spec**

- No visible change.

**Implementation**

- Delete the unused keys and any unused theme code. (A light theme can come back later as its own ticket.)

**Acceptance criteria**

- [ ] No unused theme keys remain.

**5. Test plan and definition of done**

**5.1 Multiplayer test harness**

Most bugs here need two or more players. Build this first.

- **Playwright** with multiple browser contexts in one test (each context gets its own Supabase anonymous session).

- Environment: local or preview with the "Test players" flag on and Turnstile test keys.

- Helpers: createRoom(page, {age, pack, count}), joinRoom(page, code, {age, nickname}), answerAll(page, pattern), guess(page, value), lockIn(page), nextReveal(hostPage).

- Viewports: run every E2E at 375 × 812 (guest) and 1280 × 800 (host).

- Seed: one 13+ pack and one 18+ pack with 5 questions each.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr>
<td><p>test('move on without them never softlocks (SPIL-01)', async ({ browser }) =&gt; {</p>
<p>const host = await (await browser.newContext()).newPage();</p>
<p>const guest = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();</p>
<p>const code = await createRoom(host, { age: 25, pack: 'classic', count: 5 });</p>
<p>await joinRoom(guest, code, { age: 22, nickname: 'Kwame' });</p>
<p>await startGame(host);</p>
<p>await answerAll(host, 'YNYNY');</p>
<p>await answerSome(guest, 2);</p>
<p>await host.getByRole('button', { name: 'Move on without them' }).click();</p>
<p>await host.getByRole('dialog').getByRole('button', { name: 'Move on without them' }).click();</p>
<p>await expect(guest.getByText('The host moved on.')).toBeVisible(); // SPIL-15</p>
<p>await guess(guest, 60); await lockIn(guest);</p>
<p>await expect(host.getByText('Everyone else sat out this round.')).toBeVisible();</p>
<p>await expect(host.getByText("Everyone's guessed.")).toBeVisible({ timeout: 10_000 });</p>
<p>});</p></td>
</tr>
</tbody>
</table>

**5.2 Regression checklist (run before every release)**

- [ ] Create a room as 13, 16 and 25: the pack list matches the age.

- [ ] Join an 18+ room as 16: blocked screen, no player row.

- [ ] Full 2-player game, full 3-player game (awards appear), full 12-player game with test players.

- [ ] Move on without them in answering and in guessing.

- [ ] Leave as host and as guest in every phase.

- [ ] Ties in Spill Score and in Mind Reader points.

- [ ] Reveal paced by host, with Auto on and off, with sound on and off, with reduced motion.

- [ ] Spill Mode on and off; card and awards update.

- [ ] Rematch same pack and change pack; series strip.

- [ ] Offline answering (DevTools offline) then reconnect.

- [ ] Polling-only flag on: every phase still progresses.

- [ ] Public HTML contains no admin strings (CI check).

**5.3 Definition of done (every ticket)**

- [ ] UI matches the spec at 375 px and 1280 px, in realtime and polling modes.

- [ ] Server enforces the rule, not just the UI.

- [ ] New strings are in the right namespace; no inline copy.

- [ ] Reduced motion and keyboard paths work.

- [ ] Unit and E2E tests listed in the ticket pass in CI.

- [ ] Commit authored by WISDOMSKA(SENYA), message "SPIL-XX: title", no Claude co-author trailer.

**6. Out of scope for this handoff**

These came out of the audits but are features, not fixes. Keep them for later tickets.

- Party Mode (big screen /tv view; the flag already exists).

- Daily Spill question with streaks.

- Crews and season leaderboards.

- Custom packs written by hosts.

- Live emoji reactions during the reveal.

- Teen, seasonal and local packs (SHS Days, Exam Season, Church Kid, Detty December). Content work; SPIL-02 already supports a 16+ tier for them.

- New game modes: Room Percentage, Most Likely To, Imposter, Hot Takes, Rank the Room, Who Said That?, Two Truths and a Spill, Red Flag Green Flag, Spill or Skip.

- Cosmetics, achievements and paid packs.
