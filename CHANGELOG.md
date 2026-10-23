# Changelog

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
