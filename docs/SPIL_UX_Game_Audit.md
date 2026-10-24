**UX + GAME DESIGN AUDIT · PLAYTESTED**

**SPIL**

spil-party.vercel.app, played and reviewed through the eyes of players aged 13 to 35

---

**Prepared for:** WISDOMSKA (Senya)

**Date:** 24 October 2026

**Sessions played:** 3 live games across 2 rooms (Classic, After Dark, Campus Life), host and guest, desktop and phone-sized viewports.

**Scope:** First-hand gameplay, bugs found in play, game design and scoring, screen-by-screen UX, safety and age handling, accessibility, performance, new features and new game types.

**Contents**

**1. Executive summary**

Verdict, top 5 fixes, scorecard

**2. How I played**

Sessions, setup, personas, limits

**3. How it felt: the play log**

Minute by minute, from the host and guest seats

**4. What SPIL gets right**

Verified in play

**5. Bugs found while playing**

15 issues ranked by severity, with steps to reproduce

**6. Game design review**

The missing vessel, scoring, pacing, 2-player play, labels

**7. Screen-by-screen UX**

Landing to rematch

**8. Safety and age**

What I saw when switching to 18+

**9. Accessibility and performance**

**10. New features**

Ten ideas ordered by impact

**11. New game types**

Nine modes on the same engine, with build order

**12. Roadmap and metrics**

**13. Final word**

**1. Executive summary**

I played SPIL for real this time: I hosted rooms in Chrome, joined as a second player from a separate browser on a phone-sized screen, answered, guessed, watched the reveal, toggled Spill Mode, made share cards, ran a rematch, switched the room to an 18+ pack, used "Move on without them", and left rooms.

**The short verdict:** the first game is genuinely fun. Within three minutes I had laughed at "pretended your data finished to dodge a call", felt a little exposed when my score landed, and wanted to rematch. The privacy model, the witty copy and the realtime lobby all work. But playing also surfaced problems that reading the site never would: **a softlock that kills the game**, **the host skipping the 18+ check**, **ties ranked as if one person spilled more**, **a reveal that is over in six seconds**, and the biggest design surprise of all, **the liquid "vessel" slider from the landing page is not in the actual game**. Players guess with a plain slider.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr>
<td><p><strong>Top 5 things to fix first</strong></p>
<p><strong>1. Fix the "Move on without them" softlock.</strong> In a 2-player room, moving on without the other player leaves the host on a blank guessing screen forever, even after a reload. The guest waits on the host forever. Game over.</p>
<p><strong>2. Make every player, host included, confirm 18+.</strong> I switched my room to After Dark as host and was never asked my age. Only the guest was.</p>
<p><strong>3. Put the vessel in the game.</strong> It is the most memorable thing on the landing page and it is missing exactly where it matters: the guess.</p>
<p><strong>4. Slow the reveal down and make it the climax.</strong> Each score fills in about 3 seconds and auto-advances. Add build-up, sound, tap-to-next for the host, and stop showing the rank ("2nd most spilled") before the number lands.</p>
<p><strong>5. Fix scoring fairness.</strong> Ties are ranked arbitrarily, points use "100 minus your error" so everyone scores 70 to 100, and results show two different numbers per player with no explanation.</p></td>
</tr>
</tbody>
</table>

**Scorecard (after playing)**

| **Area**                       | **Score** | **Verdict**                                                                                                                      |
| ------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Concept and hook               | 9/10      | Instantly understandable; the first round delivers on the promise.                                                               |
| Visual design and brand        | 8.5/10    | Confident dark UI, chunky type, a great desktop layout with a live sidebar. Small polish issues (digits clipped by the wave).    |
| Copywriting and tone           | 9/10      | "Waiting on Kwame. Typical." landed exactly as intended. One grammar bug: "You're a Been Around."                                |
| Onboarding and first run       | 7/10      | Room in about 4 seconds, join by code or link, Enter submits forms. Bot-check failures are silent; nickname is never remembered. |
| Core game loop                 | 6.5/10    | Answer and wait phases are solid. Guessing lost its signature vessel; the reveal is too fast; scoring is flat.                   |
| Stability                      | 4/10      | Hard softlock, stale progress counters, a dropped Start tap, inconsistent awards.                                                |
| Safety and age-appropriateness | 4/10      | Good privacy and report tools, but the host bypasses the 18+ check and adult packs are visible to everyone.                      |
| Accessibility                  | 7.5/10    | Slider works fully with arrow keys, ARIA labels everywhere, reduced motion. Avatars read as "Avatar 1" to "Avatar 24".           |
| Replay value and retention     | 4.5/10    | Rematch is smooth and keeps the room, but one mode, no series score and nothing to come back for.                                |
| Shareability and growth        | 7.5/10    | Story and group cards look great. Cards lack a way back into the game for people who see them.                                   |

**2. How I played**

**Setup**

- **Host:** Chrome on desktop (wide layout with the players sidebar).

- **Guest:** a separate browser emulating a 375 px phone, so I could see host and guest screens at the same time.

- Each browser holds one anonymous player, so my games had **2 players**. That is a common real case (couples, best friends, a quick test), but it means I could not trigger awards (they start at 3 players) or the yes-count stats (3+ answers). Those parts are reviewed from what the app shows and says.

**Sessions**

| **Game** | **Pack and setup**                                                             | **Result** | **What I tested**                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | Classic, 5 questions. Host "Senya Test", guest "Kwame" via invite link         | Completed  | Swipe and buttons, skip, back, report sheet, nudge, guessing with mouse and keyboard, reveal, results tabs, Spill Mode on and off, story and group share cards, rematch. |
| 2        | Rematch in the same room, then switched to After Dark from the lobby           | Softlocked | 18+ confirmation flow (guest and host), Start button, "Move on without them" with a half-finished guest, leaving the room.                                               |
| 3        | New room, Campus Life, 5 questions. Host "Ama", guest "Esi" via Join with code | Completed  | Nickname validation (too short, duplicate name), lowercase code entry, full round on a phone-sized guest, synced reveal on the guest, a tied score.                      |

**Personas I kept in mind**

| **Persona**           | **Context and what they care about**                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ama, 15, SHS student  | Plays at break time or sleepovers on a mid-range Android with patchy data. Wants it fast, funny and safe to show friends. |
| Kwame, 22, university | Hostel nights, pre-drinks, group trips. Wants spicy packs, chaos, bragging rights and something worth posting on Status.  |
| Esi, 31, professional | Team socials, dinner parties, reunions. Wants low setup, clear rules, nothing embarrassing, and a big-screen option.      |

**3. How it felt: the play log**

This is what a real first session felt like, from the host and guest seats.

| **When** | **What happened and how it felt**                                                                                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00     | Picked Classic and 5 questions. "About 1 minute of answering" set expectations well. Room LMGF created in about 4 seconds.                                                                                                                                                                                                               |
| 0:10     | Nickname and face screen. A face is pre-selected at random (nice), and Enter submits (nice). Lobby opens with a huge room code, Share invite and Copy link. On desktop a left sidebar shows the code and players with live presence dots. It feels like a real product.                                                                  |
| 0:30     | Guest opened the invite link. A grey skeleton showed for about 6 seconds before the nickname screen, with no sign of whose room or which pack it was. Kwame popped into the host lobby instantly. "2 in. Everyone ready?" Start.                                                                                                         |
| 0:45     | Answering. Big, readable question cards. Swiping the card right counted as Yes, buttons work, Skip moves on silently, the back arrow returns to the previous card. The report sheet is clean and fast. Questions like "pretended your data finished to dodge a call" are funny and very local. Five questions took about 30 seconds.     |
| 1:15     | Waiting screen: a vessel shows "1/2" and "Waiting on Kwame. Typical." I laughed. Nudge works. This is the brand at its best.                                                                                                                                                                                                             |
| 1:40     | Guessing: "How much has Kwame done? Be honest." A plain horizontal slider starting at 50 with a live label ("Main Character" at 71). Functional, but it felt like a settings screen after the landing page promised a pour-the-liquid moment.                                                                                            |
| 2:00     | "Everyone's guessed. Lights down." Good drama. Start the reveal.                                                                                                                                                                                                                                                                         |
| 2:05     | Reveal: "2nd most spilled · Senya Test" appeared above an empty vessel, so I knew I had lost before my number filled. Each score filled in about 3 seconds and auto-advanced. The whole reveal was over in about 6 seconds. The emotional peak passed before I could react.                                                              |
| 2:15     | Results: "You're a Main Character. The room guessed 30. They have no idea." Fun. But each row shows a Spill Score and a different "PTS" number, and I won with 91 points while Kwame, 30 points off, still got 70. Awards: "Awards start at 3 players." Questions: every count hidden. Two of three tabs were empty for a 2-player game. |
| 2:40     | Spill Mode on: instant, with a toast, and my yeses appeared by name. No "are you sure?" moment for something that cannot be unseen.                                                                                                                                                                                                      |
| 2:50     | Share card: looks great as a Story. It carried an "Open Book" award badge, even though the Awards tab said there were no awards. Rematch kept the room and pulled Kwame back automatically. Very smooth.                                                                                                                                 |

**Overall feel:** a tight, funny 3-minute loop with a beautiful wrapper. The best moments are the copy and the waiting screens. The weakest moment is the one that should be strongest: the reveal.

**4. What SPIL gets right (verified in play)**

- **Speed to fun.** From "Start a room" to the first question took well under a minute. No account, no download.

- **Realtime that feels alive.** Players appear in the lobby instantly, and phases change on both devices together, including the reveal on the guest's phone.

- **Copy with personality.** "Waiting on Kwame. Typical.", "Everyone's guessed. Lights down.", "Grab a drink." It reads like a friend running the game.

- **Privacy you can feel.** Answers are private, yes-counts stay hidden below 3 answers, and Spill Mode is opt-in and reversible for future viewers.

- **Solid answering UX.** Swipe or tap, back to fix, Skip, a report flag with clear reasons, a "Saving" indicator, offline queueing.

- **Great desktop layout.** A persistent sidebar with room code, pack and every player's live status ("0/5", "Guessing", "Locked", final score).

- **Good form handling.** Enter submits, the code field uppercases automatically, nickname errors are clear ("Someone in this room already has that name", case-insensitive).

- **Smooth rematch.** Same room code, guests pulled back to the lobby automatically, and the pack can be changed.

- **Accessible guessing.** The slider works fully with arrow keys and has a meaningful label ("Your guess for Esi").

- **Beautiful share cards.** The 9:16 story card is genuinely postable; the group card names the round winner.

**5. Bugs found while playing**

Severity: **Critical** breaks the game, **High** damages trust or fairness, **Medium** confuses players, **Low** is polish.

| **\#** | **Severity** | **What happened**                                                                                                                                                                                                           | **Steps to reproduce and fix**                                                                                                                                                                                                                              |
| ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Critical     | **Softlock after "Move on without them".** Host got a blank guessing screen with no button. Guest showed "Waiting on Senya Test" forever. A reload did not recover it, and the room stayed stuck even after the guest left. | 2-player room. Host finishes answering, guest answers 2 of 5, host taps Move on without them and confirms. Fix: if a player has nobody to guess, mark them locked automatically and go straight to "Lights down". Add a host "Skip to reveal" escape hatch. |
| 2      | High         | **The host is never asked to confirm 18+.** Switching the lobby to After Dark showed the guest a "This room is now 18+" sheet. The host was never asked.                                                                    | Host a Classic room, then Change pack and pick any 18+ pack. Fix: require confirmation from everyone, host first, before the pack can be selected.                                                                                                          |
| 3      | High         | **Live progress is stale.** The host saw "Kwame 0/5" while Kwame was on question 3. The host's own sidebar showed 0/5 while the host was on question 3.                                                                     | Watch the sidebar during answering. Fix: send progress after every answer (it is tiny) so the host does not "move on" from someone who is nearly done.                                                                                                      |
| 4      | High         | **Ties are ranked arbitrarily.** Both players scored 40, yet one was "2nd most spilled" and the other "Spilled the most".                                                                                                   | Any game where two Spill Scores match. Fix: show "Tied for most spilled" and reveal tied players together.                                                                                                                                                  |
| 5      | High         | **Silent bot-check failure.** In one browser the room API returned CAPTCHA_FAILED and the button just stopped spinning. The app has the right message but never shows it here.                                              | Open /create in a privacy-hardened browser or VPN. Fix: show the message, use Turnstile managed mode with a visible fallback, and log failures.                                                                                                             |
| 6      | Medium       | **Grammar break in the results headline:** "You're a Been Around." (likewise "You're a Mostly Innocent.").                                                                                                                  | Score between 40 and 59. Fix: write a headline per label ("You've Been Around.", "You're Mostly Innocent.").                                                                                                                                                |
| 7      | Medium       | **Award shown on the card but not in the game.** My story card had an "Open Book" badge while the Awards tab said awards start at 3 players. The badge stayed after I turned Spill Mode off.                                | 2-player game, toggle Spill Mode on then off, open Share my card. Fix: use one award source for the tabs and cards, and re-render when Spill Mode changes.                                                                                                  |
| 8      | Medium       | **The reveal spoils itself.** The rank label ("2nd most spilled") appears before the number fills, so the result is known instantly.                                                                                        | Start any reveal. Fix: show the name first, fill the vessel, then stamp the rank and label.                                                                                                                                                                 |
| 9      | Medium       | **First "Start the game" tap ignored** right after the guest confirmed 18+. It needed a second tap.                                                                                                                         | Switch to an 18+ pack, guest confirms, host taps Start once. Fix: refresh the button's ready state when confirmations arrive.                                                                                                                               |
| 10     | Medium       | **A guest who is moved on gets no explanation.** Kwame jumped from question 3 straight to guessing without a word.                                                                                                          | Same as \#1. Fix: a short sheet ("The host moved on. Your answers so far won't count, but you can still guess.").                                                                                                                                           |
| 11     | Low          | **Digits clipped by the wave.** The top of the numbers is hidden behind the wave crest on the waiting vessel, the reveal and the share card.                                                                                | Look at "1/2" on the waiting screen or "60" on the card. Fix: put the number above the liquid layer or give it a contrasting outline.                                                                                                                       |
| 12     | Low          | **Classic always looks selected.** Its tile stays solid orange even when another pack has the checkmark.                                                                                                                    | Open Change pack in a Group Chat room. Fix: use the orange fill only for the selected tile.                                                                                                                                                                 |
| 13     | Low          | **Possible dropped taps** when answering quickly during the card transition (one in five taps did not register at about 1.8-second spacing).                                                                                | Tap Yes or No rapidly. Verify on a real phone. Fix: queue taps made during the animation.                                                                                                                                                                   |
| 14     | Low          | **Leaving lands on the nickname form** ("You left the room." over a form inviting you to rejoin a game you cannot rejoin).                                                                                                  | Guest taps Leave room in-game. Fix: send them to the home screen with "Start your own room".                                                                                                                                                                |
| 15     | Low          | **Avatars announced as "Avatar 1" to "Avatar 24"** to screen readers.                                                                                                                                                       | Use names ("Devil", "Ghost", "Frog").                                                                                                                                                                                                                       |

**6. Game design review**

**6.1 The vessel is missing from the game**

The landing page sells SPIL with a tactile liquid you drag up and down, labels that stick to it and a reveal that pours. In the game, the guess is a plain range slider with minus and plus buttons. The vessel only appears on the waiting screen, the reveal and the cards. That breaks the promise at the exact moment players are most engaged.

**Recommendation:** use the vessel as the guess input on phones (drag the liquid, with haptics on Android), with minus and plus buttons kept for accessibility. It is already built for the demo, so this is mostly reuse.

**6.2 Scoring is flat and confusing**

- **Points seem to be "100 minus your error".** In my games: 9 off gave 91, 15 off gave 85, 20 off gave 80 and 30 off gave 70. Everyone scores between about 70 and 100, a lazy guess of 50 guarantees at least 50, and winning margins are tiny. It does not feel like you outplayed anyone.

- **Two numbers per player, no explanation.** Each results row shows "Spill Score 60 · the room guessed 30" and "91 PTS". New players do not know which matters or how points were earned.

- **Copy contradicts points.** Being 30 off is labelled "They have no idea" yet still earns 70 points.

**Recommendation:** banded scoring with drama. Example: exact = 10, within 5 = 7, within 10 = 4, within 20 = 1, otherwise 0. Add a "Bullseye" stamp for exact guesses and a bonus for being the closest in the room. On results, split the two ideas visually: "Your Spill Score" (identity) and "Mind Reader points" (competition), with a one-line explainer.

**6.3 The reveal is too fast to feel**

Each player's vessel fills in about 3 seconds and auto-advances. With 2 players the whole reveal took about 6 seconds; with 8 it would still be under 30. The host is told to "put your phone where the room can see it", but there is no time to react, cheer or roast.

- Let the host tap to advance (with auto-advance as an option).

- Show what the room guessed first ("The room thinks 30…"), then fill the real score. The gap between guess and truth is where the laughs live.

- Add sound: a pour, a drumroll before the top spiller, a sting for big misses.

- Stamp the label and rank only after the number lands (see bug \#8).

**6.4 Two-player games feel unfinished**

With 2 players, the Awards tab is empty, every question count is hidden, the group card is half empty, and your score reveals your exact number of yeses to the only other player. Two-player sessions (couples, best friends, long-distance calls) are common for 13 to 35s.

**Recommendation:** a dedicated Duo mode with duo awards ("Soulmates" for both guessing within 5, "Strangers" for both 30+ off), a "How well do you know each other" percentage, a duo card layout, and more questions by default to protect privacy.

**6.5 Labels and pacing**

- Labels are wide bands, so both players in game 3 were "Been Around". Add a sub-label or tie-breaker flavour ("Been Around, barely" vs "Been Around, a lot").

- A 5-question game lasts about 3 minutes end to end. That is a great demo but short for a party. Default to 10 or 15 and suggest "Best of 3" after the first game.

- Rematch resets everything. Carry a running series score across rematches, and offer a one-tap "Same pack again" instead of sending the host back through the pack picker.

**6.6 Spill Mode deserves a moment**

Turning on Spill Mode is instant and the page jumps to the bottom of the list. It is the most vulnerable action in the game. Add a short confirm ("Your yes answers will show by name to this room. People can screenshot."), and make it a social moment: a "Spill" button that the room sees light up, rather than a settings toggle.

**7. Screen-by-screen UX**

Priority: **P0** fix now, **P1** next release, **P2** nice to have.

**7.1 Landing page**

| **What I saw**                                                                       | **Recommendation**                                                                                   | **Priority** | **Persona** |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| Strong hero and dual CTA; demo vessel drifts on its own while asking you to drag it. | Freeze the idle motion once touched; show a pulsing "drag me" hint.                                  | P1           | All         |
| Decorative stickers ("Main Character", "You") sit over the demo's Reveal button.     | Move stickers off tap targets.                                                                       | P1           | Ama         |
| No social proof; Privacy and Terms only reachable through How to play.               | Add a live "rooms spilled this week" counter and a footer with How to play, Privacy, Terms, Contact. | P1           | Esi         |

**7.2 Pack picker**

| **What I saw**                                                  | **Recommendation**                                                         | **Priority** | **Persona** |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------ | ----------- |
| Question count and Continue sit below all 10 packs (on phones). | Sticky bottom bar with count + Continue.                                   | P0           | All         |
| Classic tile always orange, even when not selected (bug \#12).  | One selected style for all tiles.                                          | P1           | All         |
| Adult pack names and descriptions visible to everyone.          | Gate behind an age check (Section 8).                                      | P0           | Ama         |
| Rematch and Change pack both send the host back here.           | Offer "Same pack again" and "Change pack" as one-tap options in the lobby. | P1           | Kwame       |

**7.3 Nickname and face**

| **What I saw**                                                                            | **Recommendation**                                                                                      | **Priority** | **Persona** |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| Random face pre-selected; Enter submits; clear validation.                                | Keep. Remember the last nickname and face on this device.                                               | P1           | All         |
| Random default can be the clown or the sweaty "hot face" emoji.                           | Exclude unflattering or suggestive faces from the random default; drop the hot face in Teen-safe rooms. | P2           | Ama         |
| Guests opening an invite see a skeleton for about 6 seconds, then a form with no context. | Show "Join Senya's room · Classic · 2 players in" at the top, and pre-warm the server.                  | P1           | All         |

**7.4 Lobby**

| **What I saw**                                                                                                | **Recommendation**                                                             | **Priority** | **Persona** |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------ | ----------- |
| Huge code, share sheet, live players, host can remove. Room code appears twice on desktop (sidebar and main). | Replace the second code on desktop with a QR code for people in the same room. | P1           | Esi         |
| Cap is 12 players; "Need 2 players to start."                                                                 | Show "Ready" toggles and a Teen-safe or 18+ badge on the room.                 | P2           | All         |

**7.5 Answering**

| **What I saw**                                  | **Recommendation**                                                              | **Priority** | **Persona** |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ------------ | ----------- |
| Swipe, buttons, Skip, back and report all work. | Show skips remaining ("Skip · 2 left") and mark skipped cards when you go back. | P1           | All         |
| Sidebar progress lags (bug \#3).                | Live progress after every answer.                                               | P0           | Esi         |
| Silent, solo phase.                             | Light haptics on swipe and small pings when friends finish.                     | P1           | Kwame       |

**7.6 Waiting**

| **What I saw**                                               | **Recommendation**                                                                                                              | **Priority** | **Persona** |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| Best screen in the game: vessel, "Typical.", Nudge, Move on. | Fix the softlock (bug \#1) and tell the moved-on player (bug \#10). Give early finishers a side bet ("What % said yes to Q3?"). | P0           | All         |

**7.7 Guessing**

| **What I saw**                                                  | **Recommendation**                                                                                         | **Priority** | **Persona** |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| Plain slider starting at 50, with a live label. Keyboard works. | Use the vessel as the input (6.1). Start the handle unset or randomised to avoid everyone anchoring on 50. | P0           | All         |

**7.8 Reveal**

| **What I saw**                                                         | **Recommendation**                                                                                           | **Priority** | **Persona** |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------ | ----------- |
| About 3 seconds per player, auto-advance, rank shown before the score. | Host taps to advance, show the room's guess first, add sound, stamp rank last. Reveal tied players together. | P0           | All         |
| The reveal plays on every phone in sync. Great.                        | Add live emoji reactions from every phone.                                                                   | P1           | Kwame       |

**7.9 Results, Spill Mode, share card, rematch**

| **What I saw**                                              | **Recommendation**                                                                                | **Priority** | **Persona** |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| Two numbers per row; empty tabs in 2-player games.          | Explain points; hide empty tabs or replace them with duo content.                                 | P1           | All         |
| Spill Mode toggles instantly; page jumps.                   | Confirm step; keep scroll position.                                                               | P1           | Ama         |
| Cards are lovely; award badge inconsistent (bug \#7).       | Fix the award source. Add a QR or short link on the card that opens a "Guess my score" challenge. | P1           | Kwame       |
| Rematch keeps the room and pulls guests back automatically. | Keep, and add a series score.                                                                     | P1           | Kwame       |

**7.10 Leaving and errors**

| **What I saw**                                                                                 | **Recommendation**                                  | **Priority** | **Persona** |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------ | ----------- |
| Leave confirm explains consequences well. After leaving, the guest lands on the nickname form. | Land on home with "Start your own room" (bug \#14). | P2           | All         |

**8. Safety and age**

What I saw in play:

- Every one of the 10 packs, including "Kink Curious: Toys, roles and safe words", is visible to anyone who taps Start a room.

- When I switched the lobby to After Dark, the guest got a clear sheet: "This room is now 18+. It has sexual content. Confirm you are 18 or older." That part is well done.

- **The host was never asked.** A 15-year-old host can run an explicit pack without ever ticking a box (bug \#2).

- The lobby status read "Waiting on Kwame to confirm 18+", which publicly singles out the player who has not confirmed. In a room of older friends that is pressure on the youngest person.

- The Terms page states no minimum age.

**Recommendations:**

- Require 18+ confirmation from every player, host first, before an adult pack can be selected.

- Make **Teen-safe** the default. Put adult packs in a collapsed "After dark" section behind a date-of-birth check, with descriptions hidden until then.

- Replace "Waiting on Kwame to confirm 18+" with a neutral count ("1 player still deciding") and let people leave quietly.

- Add a minimum age (13+) and an 18+ rule for adult packs to the Terms and the landing footer.

- Build teen packs (SHS Days, Exam Season, Church Kid) so younger players have something great that is not sexual.

_I am not a lawyer. If you plan to market to under-18s in the EU or UK, or publish in app stores, have someone check the age and data rules for your target countries._

**9. Accessibility and performance**

**Accessibility**

- **Good:** the guess slider is fully keyboard-operable with a clear label; buttons back up every swipe; reduced motion is respected; dialogs have proper titles.

- **Fix:** avatars are announced as "Avatar 1" to "Avatar 24" (bug \#15).

- **Fix:** the clipped digits on vessels (bug \#11) also hurt readability for low-vision players.

- **Check:** contrast of muted grey and small mono text on the near-black background against WCAG AA.

**Performance and tech**

- **Room creation:** about 4 seconds from Continue to the nickname screen. Fine.

- **Invite links:** about 6 seconds of skeleton before the join form in my tests. Pre-warm the API and render the room name and host on the server so guests see context immediately.

- **Bot check:** fails silently in some browsers (bug \#5). Test invite links inside WhatsApp, Instagram, Snapchat and TikTok in-app browsers.

- **Message catalog:** every public page ships about 570 translation strings, including the whole admin console (roles, feature flags, "Reset all data"). Split strings by route.

- **No web app manifest:** add one so players can install SPIL to their home screen.

**10. New features**

Ordered by the impact I expect for the 13 to 35 audience, informed by what felt missing in play.

**10.1 Party Mode (big screen)**

**What:** A /tv view on a laptop, TV or projector shows the code and QR, live progress and the full reveal with sound. Phones become controllers.

**Why it matters:** The reveal was the weakest moment in my sessions because it happened on one small screen in six seconds. A shared screen turns it into the moment everyone remembers.

**Build on what you have:** The flag exists and the reveal already syncs to every phone; render the same state on a read-only screen client.

**10.2 Duo mode**

**What:** A tuned 2-player experience: duo awards, a compatibility percentage, a duo card and more questions by default.

**Why it matters:** Two of my three games were 2-player and felt unfinished. Couples and best friends are a huge share of play.

**Build on what you have:** Reuse the same loop; change results, awards and card layout when the room has 2 players.

**10.3 Daily Spill**

**What:** One question a day for everyone, with global and country percentages and streaks.

**Why it matters:** Gives people a reason to open SPIL on days without a party; Wordle-style shareable results.

**Build on what you have:** Reuse the question bank and the 3-answer privacy threshold.

**10.4 Crews, series and seasons**

**What:** Save a group as a Crew, keep a running series score across rematches, and run season leaderboards and card galleries.

**Why it matters:** Rematch already feels great; a score that carries over gives the next game stakes.

**Build on what you have:** Store scores and awards only, never raw answers.

**10.5 Remember me**

**What:** Remember nickname, face and last pack on the device; offer "Play again with the same people".

**Why it matters:** I retyped my name for every room. Small friction, repeated every night.

**Build on what you have:** Local storage only; no account needed.

**10.6 Custom packs**

**What:** Hosts write or remix up to 30 questions and share them by code; later a moderated gallery.

**Why it matters:** Inside jokes are the funniest content.

**Build on what you have:** Your admin already validates questions (length, duplicates); expose a limited version to hosts.

**10.7 Live reactions and sound**

**What:** Emoji reactions from every phone during the reveal, plus a sound set (swipe, lock in, pour, drumroll).

**Why it matters:** Turns watching into taking part; sound is half of party-game feel.

**Build on what you have:** Broadcast on the existing realtime channel.

**10.8 Remote play**

**What:** Friends on a call join the same room, with a "Start a call" shortcut.

**Why it matters:** The synced reveal already works across devices; make long-distance play a feature.

**10.9 Teen, seasonal and local packs**

**What:** SHS Days, Exam Season, Church Kid, Detty December, Valentine's, World Cup, Diaspora Life.

**Why it matters:** Campus Life was the funniest pack I played because it was specific. More of that.

**10.10 Achievements and cosmetics**

**What:** Badges ("Bullseye x5"), avatar accessories and card themes.

**Why it matters:** Collecting and self-expression matter at this age, and cosmetics are a gentle way to earn money.

**11. New game types**

Each mode reuses SPIL's rooms, lobby, private phone input, slider, synced reveal, labels, awards and share cards.

**11.1 Room Percentage**

_Prediction · Fit: very high_

**Pitch:** Guess what % of the room said yes to each question.

**How a round plays:** Answer as now, then predict the room's yes % with the vessel. Closest wins. No individual answers revealed.

**Why it lands with 13 to 35s:** Adds a second skill and keeps the privacy promise. Works from 3 players. **Age fit:** All ages

**11.2 Most Likely To**

_Vote · Fit: very high_

**Pitch:** "Who is most likely to text their ex at 2am?" Everyone votes privately.

**How a round plays:** Vote, then a bar-race reveal. Points for voting with the majority; the winner gets a title on their card.

**Why it lands with 13 to 35s:** One of the most-played group formats online, and it is about the people in the room. **Age fit:** Teen-safe and 18+ packs

**11.3 Imposter**

_Social deduction · Fit: high_

**Pitch:** Everyone gets the same secret word except one Imposter.

**How a round plays:** Say related words out loud, vote on phones, big reveal.

**Why it lands with 13 to 35s:** Hugely popular at youth parties, easy to learn, no explicit content needed. **Age fit:** All ages

**11.4 Hot Takes**

_Opinion spectrum · Fit: high_

**Pitch:** "Jollof is better with chicken than fish." Place yourself from Hard disagree to Hard agree, then guess a friend.

**How a round plays:** Private placement, then everyone shown on one shared line.

**Why it lands with 13 to 35s:** Banter without anything personal; great for teens and workplaces. **Age fit:** All ages

**11.5 Rank the Room**

_Ordering · Fit: high_

**Pitch:** "Rank us from most to least likely to survive a zombie apocalypse."

**How a round plays:** Drag-rank privately; consensus ranking reveals, plus how you ranked yourself.

**Why it lands with 13 to 35s:** Funny and fast even with 12 players. **Age fit:** All ages

**11.6 Who Said That?**

_Anonymous writing · Fit: high_

**Pitch:** Answer a prompt in a few words; guess who wrote each answer.

**How a round plays:** Type, then match answers to players.

**Why it lands with 13 to 35s:** Short funny writing is native to group-chat generations. **Age fit:** All ages with moderation

**11.7 Two Truths and a Spill**

_Bluffing · Fit: high_

**Pitch:** Pick three "Have you ever" statements about yourself; one is a lie.

**How a round plays:** The room votes on each lie; points for fooling and catching.

**Why it lands with 13 to 35s:** Bluffing makes the "wait, WHAT?" moments. **Age fit:** Teen-safe and 18+ packs

**11.8 Red Flag, Green Flag**

_Rating · Fit: medium-high_

**Pitch:** Rate dating and friendship scenarios and predict the room's verdict.

**How a round plays:** Swipe left red, right green; reveal the split.

**Why it lands with 13 to 35s:** Dating talk is huge for 16 to 30s and very shareable. **Age fit:** 16+ with a teen friendship variant

**11.9 Spill or Skip**

_Consent-first storytime · Fit: medium_

**Pitch:** After the reveal, the room votes for one "yes" they want the story behind; only Spill Mode players can be picked and anyone can pass.

**How a round plays:** Vote, tell or pass, rate the story.

**Why it lands with 13 to 35s:** The stories are the real fun; this makes consent explicit. **Age fit:** Teen-safe and 18+ with consent

**11.10 Build order**

| **Mode**               | **Impact**  | **Effort**     | **Order** | **Reason**                                         |
| ---------------------- | ----------- | -------------- | --------- | -------------------------------------------------- |
| Room Percentage        | High        | Low            | 1         | Almost no new UI; adds depth to the loop you have. |
| Most Likely To         | Very high   | Low to medium  | 2         | Proven format, perfect brand fit.                  |
| Imposter               | Very high   | Medium         | 3         | A second reason to open SPIL, for all ages.        |
| Hot Takes              | High        | Low            | 4         | Reuses the slider; teen and workplace safe.        |
| Rank the Room          | High        | Medium         | 5         | Great for big rooms.                               |
| Who Said That?         | High        | Medium to high | 6         | Needs text moderation first.                       |
| Two Truths and a Spill | Medium-high | Medium         | 7         | Best once players know the basics.                 |
| Red Flag, Green Flag   | Medium-high | Low            | 8         | Mostly a content pack on the swipe engine.         |
| Spill or Skip          | Medium      | Low            | 9         | After the Spill Mode consent work.                 |

**12. Roadmap and metrics**

| **Phase**         | **What to ship**                                                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| This week         | Fix the softlock (#1), host 18+ confirmation (#2), live progress (#3), tie handling (#4), silent bot-check error (#5), results grammar (#6), award consistency (#7).                                                             |
| Next 2 to 4 weeks | Vessel as the guess input · slower host-paced reveal with sound and "room guessed" first · banded scoring with clear explanation · Teen-safe default and gated adult packs · sticky pack-picker CTA · remember me · QR in lobby. |
| 1 to 2 months     | Party Mode · Duo mode · series score across rematches · Room Percentage and Most Likely To · teen packs · challenge link on share cards.                                                                                         |
| 3 to 6 months     | Crews and seasons · Daily Spill · custom packs · Imposter, Hot Takes, Rank the Room · reactions · cosmetics.                                                                                                                     |

**Metrics to watch**

- **Host success rate:** Continue taps that create a room.

- **Game completion rate:** games started that reach results. This will reveal the softlock.

- **Rematch rate:** the best single signal of fun.

- **Reveal dwell time:** how long rooms stay on the reveal; it should go up with Party Mode and host pacing.

- **Share rate:** cards saved or shared per finished player, and rooms started from shared links.

- **2-player share of games:** to size Duo mode.

- **D7 return:** hosts who host again within a week.

**13. Final word**

Playing SPIL confirmed what the landing page suggested: the idea, the voice and the privacy model are excellent, and the first round is genuinely fun. It also showed where the product is not yet ready for a packed Friday night: one tap can softlock a game, the host skips the 18+ check, the reveal flies past, scoring does not reward skill, and the signature vessel never shows up when you guess.

Fix the seven stability and fairness bugs this week, bring the vessel into the guess, and slow the reveal down. Then add Party Mode, Duo mode and Room Percentage, and SPIL goes from "fun once" to "the game we open every weekend".
