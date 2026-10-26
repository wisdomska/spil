# Changelog

## 1.6.0 (2026-11-01)

### Admin console

- Proper pagination on every table: numbered pages, rows per page, and the page kept in the URL.
  Rooms, reports, inbox and the audit log page on the server, so every row is reachable.
- Settings fields no longer overlap; the overview counts every open report.

### Loading

- No more "Waking the server up": a slow room keeps its loading screen and retries quietly.

### New ways to play

- Nine new game modes next to Classic: Room Percentage, Hot Takes, Most Likely To, Red Flag Green
  Flag, Rank the Room, Imposter, Two Truths, Who Said That? (18+) and Spill or Skip.
- Party Mode (a TV screen for the room), live reactions on the reveal, Today's Spill (one question
  for everyone, with streaks), crews with season tables, custom questions in 18+ rooms, teen,
  seasonal and local packs, premium packs behind the payments flag (free for now), and badges that
  unlock avatar frames and share card looks.

### Results and polish (SPIL-12 to SPIL-33)

- Results read right for every label, show only awards the room earned, and two-player rooms get a
  Duo tab and a duo card.
- One-tap Rematch with the same pack, a series score across rounds, and "Change pack".
- Start always starts on the first tap; a player the host moved on is told why; Spill Mode asks
  first; your name and face are remembered on this phone.
- Invites show whose room it is; a full code joins by itself; skips left are always shown and going
  back shows what you said; taps during the card exit are kept.
- Lobby QR code, a 20 second nudge cooldown, named faces for screen readers, haptics on Android,
  install to home screen, landing stickers that never cover a button, a weekly rooms counter, and
  vessel numbers the wave never hides.

## 1.4.0 (2026-10-24)

- The best guesser wins the round. Results rank by guessing points and say who won; every row
  still shows the player's Spill Score and label. The group card says who won.
- Awards follow the room-size rules: none below 3 players, Clueless from 5, Dark Horse only for
  someone who beat the room's guess, and Open Book never goes to the Dark Horse.
- The Questions tab lists every question from the round. Yes counts stay hidden until 3 people
  answered, so small rooms never expose anyone.
- Hosting returns to the room's creator when they come back; text fields show a single focus ring.

## 1.3.0 (2026-10-23)

- Avatars are now 24 emoji (🤪 😈 👻 🦄 and friends) on one plain background, so the face stands out.
- Bot protection (Cloudflare Turnstile) on room creation and the contact form, running in the
  background so creating a room stays quick; joining is never checked.

## 1.2.0 (2026-10-23)

- Share invite: one button opens a sheet with WhatsApp, Instagram, Snapchat, Telegram, X, Facebook,
  Messenger, Threads, Discord, Messages, Email and Copy link.
- Buttons show a spinner before the label while they work.
- New favicon and home-screen icon (the spilled speech bubble).
- `create-owner` works from any shell: `--email` flag, finds the Supabase CLI on its own.

## 1.1.0 (2026-10-23)

- Rooms can start with 2 players (was 3). Question stats still need 3 answers, so nobody's
  answers are exposed in a 2-player room.
- Dark only: the theme menu and toggles are gone; share cards are always dark.
- Info pages: header, tabs and text line up in one column, and the tabs fill it on every screen.
- Join page: "No code? Start your own room" for people who arrive without an invite.
- Vercel Web Analytics and Speed Insights are on.

## 1.0.0 (2026-10-23)

First public release.

### Game

- Rooms with a 4-letter code, a shareable link and a WhatsApp invite; 3 to 12 players by default.
- Pack picker with 9 live packs (adult packs behind an 18+ confirmation for every player) and a
  host-chosen question count.
- Private "Have you ever…" answering by swipe, tap or keyboard, with an offline queue.
- Guessing each friend's Spill Score, host force-advance for slow players, host hand-over.
- Synced reveal ceremony on every phone, results with scores, six awards and question stats.
- Spill Mode: players can opt in to show their own answers to the room; nobody else's leak.
- Share card (1080×1920 PNG) and rematch with the same code and a new pack.

### Admin console (`/admin`)

- Overview, Rooms, Packs, Questions (CSV import and export), Reports, Inbox, Audit log, Settings.
- Roles: owner, content lead, moderator. Every write is audited.

### Platform

- Next.js 16, React 19, Tailwind v4, Supabase (Postgres, RLS on every table, Realtime, anonymous
  auth), Vercel.
- Security headers and CSP, rate limits, Turnstile-ready, service-role key never in the browser.
- Optional Sentry, PostHog (no cookies) and Vercel Analytics.
- CI: authorship check, typecheck, lint, unit tests, pgTAP, API tests. Deploy workflow applies
  migrations and checks the live site; nightly e2e, cross-browser and design parity runs.

See docs/QA_REPORT.md for test results and docs/OPEN_ITEMS.md for what is still open.
