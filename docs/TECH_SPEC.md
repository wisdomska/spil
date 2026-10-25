# SPIL Technical Specification

Version 1.0 · 22 October 2026 · Owner: WISDOMSKA (SENYA)
Production URL: **https://spil-party.vercel.app**

This document tells Claude Code (or any engineer) exactly how to build SPIL v1.0. It turns the product requirements (SRS) and the Claude Design handoff ("SPIL Design System complete.zip") into one build plan. When this spec and the design disagree, section 2 says which wins. When something is not covered here, the design prototype is the reference for look and behaviour, and the SRS is the reference for rules.

---

## 0. How Claude Code should use this document

1. Read this whole file before writing code. Then read `design/handoff/HANDOFF.md`, `design/handoff/tokens.css` and `design/handoff/spil-theme.css`.
2. Build in the order of section 22 (Build plan). Finish each milestone, run its checks, commit, then move on.
3. Treat `design/*.dc.html` files as the visual and behavioural reference. Open them in a browser to see every screen and state. Port their look into React components; do not copy their runtime (`support.js`, `spil-store.js` are prototype-only).
4. `spil-store.js` contains the prototype's game logic. Section 13 restates it as the production rules. Port the logic to `lib/game/*` in TypeScript, not the localStorage store.
5. Never invent new colours, fonts, radii or motion values. Everything comes from the tokens.
6. Git: all commits are authored as WISDOMSKA (SENYA). **Do not add `Co-Authored-By` lines, "Generated with Claude" footers, or any AI attribution** to commits, PRs, code comments or docs.

---

## 1. Product summary

SPIL is a mobile-first web party game. A host creates a private room and shares a link. Friends join with a nickname (no signup), privately answer "Have you ever..." yes/no questions, guess each other's Spill Score (0 to 100, higher = has done more), and watch an animated reveal with awards. Players can share a result card. Individual answers stay private unless a player opts in to Spill Mode.

Sources of truth:

| Source | Location in repo | Use it for |
|---|---|---|
| This spec | `docs/TECH_SPEC.md` | Architecture, data, API, build order |
| SRS | `docs/SRS.md` (export of "SPIL – Software Requirements Specification") | Product rules, requirement IDs (FR-*, NFR-*) |
| Design handoff | `design/handoff/HANDOFF.md`, `tokens.css`, `spil-theme.css` | Tokens, motion specs, engineering rules |
| Design prototype | `design/SPIL App.dc.html`, `SPIL Prototype.dc.html` | Exact screens, copy, states, interactions |
| Screen inventory | `design/SPIL Screens *.dc.html` | Every screen and state to implement |
| Components | `design/SPIL Components.dc.html`, `SPIL Design System.dc.html`, `SPIL Avatar.dc.html` | Component anatomy, avatars |
| Share cards | `design/SPIL Share Card(s).dc.html` | Card layouts at 1080x1920, 1080x1080, 1200x630 |
| Admin | `design/SPIL Admin.dc.html`, `SPIL Screens Admin.dc.html` | Admin console |
| QA reference | `design/SPIL Tests.dc.html` | 37 behavioural checks to port as tests (section 19) |

Setup step: unzip the design archive into `/design` at the repo root and commit it. Do not ship `/design` to production (it is excluded from the Next.js build because nothing imports it).

---

## 2. Decisions reconciled (design vs SRS)

The design prototype was made after the SRS and changed some details. These are the final decisions.

| Topic | SRS said | Design does | **Build this** |
|---|---|---|---|
| Max players | 20 | 12 ("assumed") | Admin setting `max_players`, default **12**, allowed 3 to 20 |
| Min players | 3 | 3 | Admin setting `min_players`, default **3** |
| Questions per game | Whole pack (about 50) | Random draw of `questionsPerGame` (12) from the pack | Admin setting `questions_per_game`, default **12**, allowed 5 to 100. Drawn randomly, unique, from live questions. Packs should still hold 30+ questions for variety |
| Room phases | lobby, answering, guessing, revealed | adds `ready` (all guesses in, host taps Reveal) and `closed` | `lobby → answering → guessing → ready → revealed`, plus `closed` |
| Rematch | New room | Same room, `round + 1`, answers and guesses cleared, can switch pack | **Same room code, new round** |
| Room expiry | Deleted after 7 days | Join blocked after 24 hours | Joining blocked when room is `closed` or older than **24 h**. All room data hard-deleted **7 days** after creation |
| Mind Reader | Average of (100 − abs(guess − score)) | Sum of max(0, 50 − abs(guess − score)) | **Average accuracy, 0 to 100**: mean of (100 − abs(guess − actual)) over the player's guesses. Shown as "N points" |
| Clueless award | Only in rooms of 5+ | Always (6 awards) | **Always give all 6 awards** (the reveal choreography expects 6) |
| Admin sign-in | Email OTP only | Email + password, "Forgot password" with 6-digit code | **Supabase email + password**, password reset by 6-digit email OTP. Allow-list via `admins` table |
| Admin roles | admin, moderator | Owner, Content lead, Moderator | `owner`, `content_lead`, `moderator` (permissions in section 17) |
| Admin sections | packs, questions, reports, stats, audit | Overview, Rooms, Packs, Questions, Reports, Inbox, Audit log, Settings | **Design's 8 sections** |
| Contact page | Static page | Form that lands in admin Inbox | Form → `messages` table → Inbox |
| Adult packs | `is_spicy` flag | `adult` + `heat` = spicy, explicit or intense | `is_adult` boolean + `heat` enum (`spicy`, `explicit`, `intense`). Every adult pack needs every player's 18+ confirmation |
| Pack status | `is_active` | live, draft, hidden | `status` enum `live`, `draft`, `hidden`. Only `live` packs with 1+ live question appear in the picker |
| Light accent | #E5401F | #D63D1D (contrast fix) | **#D63D1D**, accent text `#B8321A` (tokens.css is final) |
| Test players ("bots") | Not in SRS | Prototype bots answer and guess automatically | **Dev and staging only**, behind `feature_flags.test_players`. Never in production |
| Share link text | n/a | `spil.party` placeholder | **spil-party.vercel.app** |
| Hosting | Vercel | n/a | Vercel project `spil-party`, domain `spil-party.vercel.app` |

**Content warning, must fix before launch.** The prototype seeds an adult pack called "The Purity 100" whose 100 questions closely follow the Rice Purity Test. SRS section 7 requires all questions to be original. Do not seed that pack in production. Seed it only as `draft` in local/dev so the UI can be tested, and flag it in `docs/OPEN_ITEMS.md` for the Content Lead to replace with original questions and a new name.

---

## 3. Tech stack

React is the UI layer throughout. Next.js is used as the React framework because it gives server rendering for link previews, API route handlers and first-class Vercel hosting.

Pin exact versions in `package.json` at scaffold time (latest stable of each major listed). Use `pnpm`.

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript 5.x, `strict: true`, `noUncheckedIndexedAccess: true` | |
| UI library | **React 19** | |
| Framework | **Next.js 15+ (App Router)** | Server Components by default; client components only where interactive |
| Styling | **Tailwind CSS v4** with `@tailwindcss/postcss` | Theme from `design/handoff/spil-theme.css`; no `tailwind.config.js` |
| Primitives | **Radix UI** (`@radix-ui/react-dialog`, `-toggle-group`, `-tabs`, `-switch`, `-dropdown-menu`, `-tooltip`, `-visually-hidden`) | Accessibility for dialogs, sheets, toggles, tabs |
| Animation | **Motion** (`motion/react`) | Card drag and reveal; CSS keyframes for simple slaps and drops |
| Icons | **@phosphor-icons/react**, regular weight only | Design uses Phosphor web font classes; map `ph ph-<name>` to `<Name />` |
| Fonts | `next/font/google` for **Bricolage Grotesque** (variable, axes `wdth`, `opsz`); `geist` npm package for **Geist** and **Geist Mono** | `font-synthesis: none` globally |
| Server data | **@tanstack/react-query v5** | Fetching, retries, offline mutation queue |
| Client UI state | **zustand** | Theme, local answer queue, reveal playback |
| Validation | **zod** | Shared schemas client and server |
| Backend | **Supabase**: Postgres 15+, Auth (anonymous + email/password), Realtime | `@supabase/supabase-js` v2 + `@supabase/ssr` |
| Share images | **modern-screenshot** (client PNG capture of the card component) + **next/og** (`ImageResponse`) for Open Graph images | See section 16 |
| Bot protection | Cloudflare **Turnstile** (free) on anonymous sign-in and room creation | Supabase Auth supports Turnstile captcha natively |
| i18n-ready strings | **next-intl** (English only for v1) | All copy in `messages/en.json` |
| Errors | **@sentry/nextjs** (free tier) | |
| Analytics | **PostHog** (free tier) via `posthog-js` | No answer content ever sent |
| Unit/integration tests | **Vitest**, **@testing-library/react** | |
| E2E | **Playwright** (+ `@axe-core/playwright`) | |
| DB tests | **pgTAP** via `supabase test db` | RLS and SQL functions |
| Lint/format | ESLint (next config + `jsx-a11y`), Prettier | |
| CI | GitHub Actions | |

Not used: Redux, styled-components, CSS-in-JS, Lucide, Inter, any UI kit (shadcn, MUI, Chakra).

---

## 4. Hosting and environments

| Environment | URL | Supabase project | Notes |
|---|---|---|---|
| Local | `http://localhost:3000` | Supabase CLI in Docker (`supabase start`) | Seed + test players enabled |
| Preview | Vercel preview URL per PR | `spil-staging` | Test players enabled |
| Production | **https://spil-party.vercel.app** | `spil-prod` | Test players disabled |

Vercel:

- Project name **`spil-party`** so the default production domain is `spil-party.vercel.app`. Framework preset Next.js, Node 20 LTS, region closest to West Africa that the plan allows (e.g. `cdg1` Paris or `lhr1` London; Supabase project in the same region, e.g. `eu-west-2` London or `eu-west-3` Paris).
- Hobby plan at launch. Hobby is for non-commercial use: upgrade to Pro before payments (v1.1).
- Cron (`vercel.json`): `{"crons":[{"path":"/api/cron/expire","schedule":"0 3 * * *"}]}` (Hobby allows daily).
- Set `metadataBase` to `https://spil-party.vercel.app` so OG URLs are absolute.

Supabase:

- Enable **Anonymous sign-ins** and **Email** provider (password). Enable Turnstile captcha in Auth settings.
- Auth Site URL `https://spil-party.vercel.app`; redirect URLs: production, `https://*-spil-party*.vercel.app/**` (previews), `http://localhost:3000/**`.
- Email templates: password recovery uses the 6-digit `{{ .Token }}` (design shows a code, not a link).
- Free plan pauses after inactivity: add a GitHub Actions schedule (every 3 days) that calls `GET /api/health` which runs `select 1` against production.

---

## 5. Repository layout

```
spil/
  app/
    layout.tsx                    # fonts, theme script, grain layer, providers
    globals.css                   # @import tailwindcss, tokens.css, spil-theme.css, base styles
    page.tsx                      # Landing
    join/page.tsx                 # Join with code
    create/page.tsx               # Pack picker (host)
    r/[code]/
      layout.tsx                  # room shell: desktop left panel at lg, realtime provider
      page.tsx                    # resolves room phase and renders the right screen
      me/page.tsx                 # Profile setup (nickname, avatar, 18+ confirm)
    how-to-play/page.tsx
    privacy/page.tsx
    terms/page.tsx
    contact/page.tsx
    admin/
      login/page.tsx
      reset/page.tsx
      (console)/layout.tsx        # admin shell with 8-section nav
      (console)/page.tsx          # Overview
      (console)/rooms/page.tsx
      (console)/packs/page.tsx
      (console)/questions/page.tsx
      (console)/reports/page.tsx
      (console)/inbox/page.tsx
      (console)/audit/page.tsx
      (console)/settings/page.tsx
    api/
      v1/...                      # route handlers (section 12)
      cron/expire/route.ts
      health/route.ts
    og/
      route.tsx                   # default site OG image
      r/[code]/route.tsx          # room invite OG image
    not-found.tsx
    error.tsx
  components/
    ui/                           # Button, IconButton, Input, CodeInput, Slider, Switch, Sheet, Modal, Toast, Tabs, ThemeToggle, Skeleton
    brand/                        # Wordmark, Grain, Sticker, LabelSticker, AwardSticker, Avatar, Vessel, PourProgress, LiquidNumber
    game/                         # PackTile, PlayerSticker, QuestionCard, AnswerButtons, GuessCard, RevealStage, ResultsTabs, ShareCard, ShareSheet
    room/                         # RoomPanel (desktop), LobbyView, QuestionView, WaitingView, GuessView, ReadyView, ResultsView
    admin/                        # AdminNav, DataTable, StatTile, EditDialog, ConfirmDialog
  lib/
    game/                         # scoring.ts, awards.ts, labels.ts, codes.ts, draw.ts, rotation.ts, results.ts (pure, fully tested)
    supabase/                     # client.ts (browser), server.ts (RSC/route), admin.ts (service role, server only)
    api/                          # fetchers, query keys, mutation hooks
    realtime/                     # useRoomChannel.ts, polling fallback
    theme/                        # theme-script.ts, useTheme.ts
    analytics/                    # posthog.ts, events.ts (typed event names)
    validation/                   # zod schemas
    ratelimit.ts
    flags.ts
  messages/en.json                # all UI copy
  supabase/
    migrations/                   # numbered SQL migrations
    seed.sql                      # packs, questions, settings, flags
    tests/                        # pgTAP
  tests/
    unit/  e2e/  fixtures/
  design/                         # unzipped Claude Design archive (reference only)
  docs/TECH_SPEC.md  docs/SRS.md  docs/OPEN_ITEMS.md
  CLAUDE.md
  .github/workflows/ci.yml  .github/workflows/keepalive.yml
  vercel.json
```

---

## 6. Design system implementation

### 6.1 Tokens and Tailwind

- Copy `design/handoff/tokens.css` and `design/handoff/spil-theme.css` to `app/styles/` unchanged. `globals.css`:
  ```css
  @import "tailwindcss";
  @import "./styles/tokens.css";
  @import "./styles/spil-theme.css";
  html { font-synthesis: none; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
  body { font-family: var(--font-sans); font-size: var(--text-body); }
  ```
- `spil-theme.css` resets the Tailwind palette (`--color-*: initial`). Only token colours exist: `bg`, `surface`, `surface-raised`, `line`, `line-strong`, `text`, `text-muted`, `accent`, `accent-ink`, `on-accent`, `accent-soft`, `inverse`, `on-inverse`, `sticker-edge`, `sticker-ring`, `error`, `success`, `scrim`, `skeleton`. A lint rule (or a simple CI grep) fails on hex colours in `components/` and `app/` outside `styles/`.
- Radius utilities: `rounded-pill` (all interactive controls), `rounded-card` (cards, sheets, modals, pack tiles), `rounded-input` (fields, code boxes).
- Spacing is the 4 px grid (`--spacing: 4px`), so `p-5` = 20 px.

### 6.2 Fonts

```ts
// app/fonts.ts
import { Bricolage_Grotesque } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
export const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth", "opsz"], variable: "--font-bricolage", display: "swap" });
```
Map `--font-display: var(--font-bricolage)`, `--font-sans: var(--font-geist-sans)`, `--font-mono: var(--font-geist-mono)` in `tokens.css` overrides. Emphasis in display type is `font-stretch: 75%` plus `text-accent-ink` (Bricolage has no italic). All numbers use `font-mono tabular-nums`.

### 6.3 Theme

- `localStorage["spil-theme"]` = `dark` | `light` | `system`. Default **dark**.
- Inline blocking script in `<head>` (in `layout.tsx` via `dangerouslySetInnerHTML`) sets `document.documentElement.dataset.theme` before first paint: `dark` → `data-theme="dark"`, `light` → `"light"`, `system` → remove attribute (media query decides). Wrap storage access in try/catch.
- `<ThemeToggle>` is a Radix `ToggleGroup` with three pill items (Moon, Sun, Device). Icon remount animation per HANDOFF; colours swap instantly.
- `<meta name="theme-color">` updated on change (`#101114` dark, `#F1F2F4` light).

### 6.4 Grain

One `<Grain />` element at the root of `layout.tsx`: `position: fixed; inset: 0; pointer-events: none; z-index: var(--z-grain)`, an SVG noise texture as a data URI background, `opacity: var(--grain-opacity)`, `mix-blend-mode: var(--grain-blend)`. Never on a scrolling element.

### 6.5 Z-index scale (`lib/constants.ts` and CSS vars)

`--z-base: 0`, `--z-sticky: 10`, `--z-sheet: 40`, `--z-toast: 50`, `--z-grain: 60`. No other z-index values.

### 6.6 Components to build

Build each to match `design/SPIL Components.dc.html` with every state: default, hover (colour only), pressed (scale per HANDOFF), focus-visible (3 px accent outline, 3 px offset), disabled, loading (mini pour inside the button, never a spinner), error.

| Component | Key rules |
|---|---|
| `Button` | variants `primary` (accent), `secondary` (raised), `ghost`, `destructive`; height 56 (`--btn-h`); pill; label never wraps; `active:scale-[.97]` |
| `IconButton` | 48x48 hit area; press scale .92 |
| `AnswerButtons` | Yes = filled accent + check icon + word; No = outlined + X icon + word; height 64; `navigator.vibrate?.(10)` |
| `CodeInput` | One real `<input autocomplete="one-time-code" autocapitalize="characters" inputmode="text" maxlength="4">` over 4 visual boxes; strip spaces and dashes on paste; uppercase; alphabet excludes O, I, 0, 1 |
| `TextInput` | label above, helper below, error below with icon; edge uses `--line-strong` |
| `Slider` | `role="slider"`, arrows ±1, PageUp/PageDown ±10, Home/End, `aria-valuetext="64, Main Character"`, separate 48 px −/+ stepper buttons; thumb not animated |
| `Switch` | Radix Switch; knob spring per HANDOFF |
| `Sheet` / `Modal` | Radix Dialog. Below `lg`: bottom sheet (slide from 100%, `--ease-drawer`, 400 ms). At `lg`+: centred modal 440 wide (scale .96 + fade, 200 ms) |
| `Toast` | from y 8 + fade, 240 ms; `aria-live="polite"` |
| `Tabs` | Radix Tabs with pill triggers, no animation on switch |
| `Skeleton` | `animate-breathe`, shaped like the final layout |
| `Avatar` | 24 original pattern avatars from `design/SPIL Avatar.dc.html`, rendered as React SVG components (port the design's shapes exactly); index 0 to 23; legible at 32 px |
| `Sticker` | thick `--sticker-edge` border (4 px; 3 px at 40 px avatars; 8 to 10 px on share cards), `ring-[1.5px] ring-sticker-ring`, rotation from a seeded list per player (`lib/game/rotation.ts`, range −4 to 4°, stable across renders). Only stickers rotate |
| `LabelSticker` | the 5 score labels with their shapes and tones (section 13.3) |
| `AwardSticker` | 6 awards, Phosphor icon, tone and shape per section 13.4 |
| `PlayerSticker` | avatar + nickname chip; host remove button (visible 30 px, hit 48 px); status icon + word ("Done", "38/12") |
| `PackTile` | glyph disc, name, question count, 18+ badge with heat, tone; press .98; selected check-tick; varied tile sizes |
| `Vessel` + `LiquidNumber` | fill layer `translateY(100 − level%)`; wave strip; number rendered twice (`--text` over empty, `--on-accent` inside fill with `overflow:hidden`, bottom anchored) so colour flips at the waterline |
| `PourProgress` | `clip-path: inset(0 X% 0 0 round 999px)`, 300 ms ease-out, drip on a translateX layer |
| `QuestionCard` | drag/flick/return per HANDOFF motion table using `useMotionValue` (no React state on pointermove); keyboard Y/N/←/→ answers with no motion |
| `Wordmark` | "SPIL" with the dripping L, from the design's SVG |

**One liquid moment per screen.** Never render two of: hero phone, PourProgress, waiting Vessel, reveal LiquidNumber, results mini Vessel, share card Vessel.

### 6.7 Layout and breakpoints (from HANDOFF)

- Base 360 to 599: single column, content max 520, side padding 20.
- `md` 600: wider gutters; pack grid `repeat(auto-fill, minmax(150px, 1fr))`.
- `lg` 1024: in-room screens get the 340 px left `RoomPanel` (room code, players with status, theme toggle, leave). Main column max 520, top padding 48. Sheets become modals.
- `xl` 1280: landing hero splits into text + phone; steps run 3 across; long-form pages cap at 720.
- Reveal is always a full-bleed stage, max 560 wide, at every size.
- Hero headline uses container query units: wrapper `container-type: inline-size`, `font-size: clamp(46px, 7.2cqi, 100px)`.
- Use `min-h-[100dvh]`, never `h-screen`.

### 6.8 Copy

- All strings in `messages/en.json`, taken verbatim from the prototype.
- No em dashes or en dashes anywhere in UI copy (CI grep fails the build on `—` or `–` in `messages/` and `components/`).
- One label per intent: "Start a room", "Join with code".

---

## 7. Routes and screens

Every screen and variant below exists in `design/SPIL Screens Mobile Dark.dc.html` (mobile 390 x 844, both themes) and the desktop/admin sets. Implement each variant as a real state, not a mock.

| Route | Screen (design id) | Variants to implement |
|---|---|---|
| `/` | `landing` | default, theme menu open |
| `/join` (and `/join?code=K7QX`) | `join` | typing, invalid, expired, full, started |
| `/create` | `packs` | default, adult pack selected (confirm notice) |
| `/r/[code]/me` | `profile` | default, nickname error, adult age check |
| `/r/[code]` status `lobby` | `lobby` | empty (host alone), Start disabled (< min players), full host view, guest view, loading skeleton |
| `/r/[code]` status `answering`, not submitted | `question` | default, dragging Yes/No, saving, offline |
| `/r/[code]` answering submitted / guessing submitted | `waiting` | host (Nudge, Force next), Force next sheet/modal, guest |
| `/r/[code]` status `guessing` | `guess` | default |
| `/r/[code]` status `ready` | `ready` | host sees Reveal; guests see "Waiting for the host" |
| `/r/[code]` status `revealed`, ceremony | `reveal` | counting, label slapped, award; Skip always visible |
| `/r/[code]` status `revealed`, after ceremony | `results` | Scores tab, Awards tab, Questions tab + Spill Mode, Share sheet |
| any | `error` | not found, expired, full, game started, offline, server waking up |
| `/how-to-play`, `/privacy`, `/terms`, `/contact` | `page` | howto, privacy, terms, contact (form) |
| `/admin/login`, `/admin/reset` | admin login | sign in, reset with 6-digit code |
| `/admin/*` | Overview, Rooms, Packs, Questions, Reports, Inbox, Audit log, Settings | as `design/SPIL Admin.dc.html` |

Room routing: `/r/[code]/page.tsx` is a client component that reads `GET /api/v1/rooms/[code]/state` and renders the view for `(room.status, me.answersSubmitted, me.guessesSubmitted, revealSeen)`. Screen changes are not animated. If the visitor has no player in the room: redirect to `/r/[code]/me` when `status = lobby`, else show the matching error. Room pages set `robots: { index: false }`.

Deep link: `https://spil-party.vercel.app/r/K7QX` is the invite link. Its OG image (section 16) shows the pack and host.

---

## 8. Client state and data flow

- **Server state** in TanStack Query. Key: `["room", code]` for `/state`. `staleTime: 0`, `refetchOnWindowFocus: true`.
- **Realtime as signal**: on any room event, `queryClient.invalidateQueries(["room", code])`. If the channel is not `SUBSCRIBED` within 5 s or drops, poll `/state` every 5 s until it reconnects. Also poll when `feature_flags.polling_only` is on.
- **Answers**: optimistic. Each tap updates the local zustand queue and the cache immediately, then `PUT /answers` with the batch. Failed writes stay queued (persisted to `sessionStorage`) and retry on reconnect with backoff (1 s, 2 s, 4 s, max 30 s). Show the "saving" and "offline" variants from the design.
- **Guesses**: same pattern, debounced 400 ms.
- **Reveal playback** is client-side choreography driven by the results payload; all clients start when `status` becomes `revealed` (event carries `revealed_at`; clients align their start to it, max 2 s skew).
- **Session**: on first create or join, call `supabase.auth.signInAnonymously({ options: { captchaToken } })`. Session persists in cookies via `@supabase/ssr`, so refresh and reopen return to the room.

---

## 9. Database schema

All tables in `public`, UUID keys (`gen_random_uuid()`), `timestamptz` in UTC. Migrations in `supabase/migrations`. Enable RLS on every table.

```sql
-- 0001_enums.sql
create type pack_status as enum ('live','draft','hidden');
create type heat_level  as enum ('spicy','explicit','intense');
create type pack_tone   as enum ('accent','inverse','raised');
create type q_status    as enum ('live','draft','hidden');
create type room_status as enum ('lobby','answering','guessing','ready','revealed','closed');
create type player_status as enum ('active','left','removed','sat_out');
create type answer_value as enum ('yes','no','skip');
create type report_type as enum ('question','nickname','other');
create type report_status as enum ('open','actioned','dismissed');
create type message_status as enum ('new','read','archived');
create type admin_role as enum ('owner','content_lead','moderator');

-- 0002_content.sql
create table packs (
  id text primary key,                         -- slug, e.g. 'classic'
  name text not null check (char_length(name) between 2 and 40),
  blurb text not null check (char_length(blurb) <= 140),
  icon text not null,                          -- Phosphor icon name, e.g. 'cards'
  tone pack_tone not null default 'raised',
  is_adult boolean not null default false,
  heat heat_level,                             -- required when is_adult
  region text,                                 -- 'GH','NG' or null
  status pack_status not null default 'draft',
  sort_order int not null default 100,
  updated_at timestamptz not null default now(),
  check ((is_adult and heat is not null) or (not is_adult and heat is null))
);
create table questions (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null references packs(id) on delete cascade,
  text text not null check (char_length(text) between 8 and 120), -- stored without "Have you ever"
  status q_status not null default 'live',
  yes_count int not null default 0,
  answered_count int not null default 0,
  report_count int not null default 0,
  updated_at timestamptz not null default now()
);
create index on questions(pack_id, status);

create table settings (
  id boolean primary key default true check (id),   -- singleton
  questions_per_game int not null default 12 check (questions_per_game between 5 and 100),
  max_players int not null default 12 check (max_players between 3 and 20),
  min_players int not null default 3 check (min_players between 3 and 20),
  updated_at timestamptz not null default now()
);
create table feature_flags (key text primary key, enabled boolean not null default false);
-- keys: polling_only, adult_packs_enabled, test_players, payments_enabled, party_mode

-- 0003_rooms.sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code char(4) not null,
  pack_id text not null references packs(id),
  status room_status not null default 'lobby',
  round int not null default 1,
  final_round int not null default 0,          -- idempotency guard for finalize
  host_player_id uuid,
  created_by uuid not null,                    -- auth.uid()
  created_at timestamptz not null default now(),
  started_at timestamptz, guessing_at timestamptz, ready_at timestamptz, revealed_at timestamptz,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create unique index rooms_code_live on rooms(code) where status <> 'closed';

create table room_questions (
  room_id uuid not null references rooms(id) on delete cascade,
  round int not null,
  position int not null,
  question_id uuid not null references questions(id),
  primary key (room_id, round, position),
  unique (room_id, round, question_id)
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null,
  nickname text not null check (char_length(nickname) between 2 and 20),
  avatar smallint not null check (avatar between 0 and 23),
  rotation_seed int not null,                  -- picks sticker tilt
  age_confirmed boolean not null default false,
  is_bot boolean not null default false,       -- test players, non-prod only
  status player_status not null default 'active',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  answers_submitted_at timestamptz,
  guesses_submitted_at timestamptz,
  spill_mode boolean not null default false,   -- reset to false every round
  hide_name_on_card boolean not null default false,
  unique (room_id, user_id)
);
create unique index players_nick_unique on players(room_id, lower(nickname)) where status = 'active';
alter table rooms add constraint rooms_host_fk foreign key (host_player_id) references players(id) on delete set null;

create table answers (
  player_id uuid not null references players(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  round int not null,
  question_id uuid not null references questions(id),
  value answer_value not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, round, question_id)
);
create table guesses (
  guesser_id uuid not null references players(id) on delete cascade,
  target_id uuid not null references players(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  round int not null,
  value smallint not null check (value between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (guesser_id, target_id, round),
  check (guesser_id <> target_id)
);
create table results (
  room_id uuid not null references rooms(id) on delete cascade,
  round int not null,
  player_id uuid not null references players(id) on delete cascade,
  spill_score smallint not null,
  label text not null,
  avg_guess_about smallint not null,
  mind_reader smallint not null,
  rank smallint not null,
  primary key (room_id, round, player_id)
);
create table awards (
  room_id uuid not null references rooms(id) on delete cascade,
  round int not null,
  award text not null,                         -- 'top_spiller' etc.
  player_id uuid not null references players(id) on delete cascade,
  reason text not null,
  position smallint not null,
  primary key (room_id, round, award)
);

-- 0004_ops.sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  type report_type not null,
  question_id uuid references questions(id) on delete set null,
  player_id uuid references players(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  reason text not null check (char_length(reason) <= 280),
  reporter_user_id uuid not null,
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz, resolved_by uuid
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  name text check (char_length(name) <= 60),
  email text check (char_length(email) <= 120),
  body text not null check (char_length(body) between 5 and 2000),
  status message_status not null default 'new',
  created_at timestamptz not null default now()
);
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role admin_role not null,
  created_at timestamptz not null default now()
);
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_user_id uuid, who text not null, action text not null, target text not null,
  before jsonb, after jsonb
);
create table rate_limits (key text not null, window_start timestamptz not null, count int not null default 0, primary key (key, window_start));
create table stats_daily (day date primary key, games_started int not null default 0, games_finished int not null default 0, joins int not null default 0);
create table pack_plays (pack_id text references packs(id) on delete cascade, day date, started int default 0, primary key (pack_id, day));
```

Helper SQL functions (security definer, `search_path = public`):

- `is_room_member(p_room uuid) returns boolean`: exists active player with `user_id = auth.uid()`.
- `is_admin(p_roles admin_role[] default null) returns boolean`.
- `check_rate_limit(p_key text, p_limit int, p_window interval) returns boolean`.
- `expire_rooms()`: `update rooms set status='closed' where status='lobby' and created_at < now() - interval '24 hours'`; `delete from rooms where expires_at < now()`; delete anonymous `auth.users` with no players and `last_sign_in_at < now() - interval '30 days'`.
- `advance_room(p_room uuid, p_from room_status, p_to room_status) returns rooms`: `select ... for update`; if `status <> p_from` raise `WRONG_PHASE`; set status and the matching timestamp. Called only by route handlers with the service role, after they check the actor is host.
- `save_results(p_room uuid, p_round int, p_results jsonb, p_awards jsonb) returns void`: locks room; if `final_round = p_round` return (idempotent); insert results and awards; add answer counts to `questions.yes_count/answered_count`; increment `stats_daily.games_finished`; set `final_round = p_round`, `status = 'revealed'`, `revealed_at = now()`.
- `start_round(p_room uuid, p_pack text, p_n int) returns void`: deletes answers, guesses for the room's current round, increments `round` (except first start), draws `p_n` random live questions (`order by random() limit p_n`) into `room_questions`, resets players' submitted timestamps and `spill_mode`, sets `status='answering'`, `started_at = now()`. If the new pack is adult, sets `age_confirmed = false` for all players and keeps status `lobby` until all confirm.

---

## 10. Row Level Security

Browser uses the anon key. Writes go through route handlers using the service role, so RLS for players is mostly read rules. Every policy has a pgTAP test.

| Table | select | insert / update / delete (client) |
|---|---|---|
| packs | `status='live'` or `is_admin()` | admin only (`owner`, `content_lead`) |
| questions | `status='live'` and pack live, or `is_admin()` | admin only (`owner`, `content_lead`; `moderator` may set status hidden) |
| settings, feature_flags | everyone | `owner` only |
| rooms | `is_room_member(id)` or `is_admin()` | none (service role) |
| room_questions | `is_room_member(room_id)` | none |
| players | `is_room_member(room_id)`, via view `players_public` exposing id, nickname, avatar, rotation_seed, status, submitted flags, spill_mode, is host | none (service role) |
| answers | own rows (`player_id` belongs to `auth.uid()`); others only when room `status='revealed'` and that player's `spill_mode = true` | none |
| guesses | own rows; all room guesses when room `status='revealed'` | none |
| results, awards | `is_room_member(room_id)` and room `status='revealed'` | none |
| reports | `is_admin()` | none (API inserts) |
| messages | `is_admin()` | none (API inserts) |
| admins, audit_log, rate_limits, stats_daily, pack_plays | `is_admin()` (rate_limits: none) | none |

Realtime private channels: policy on `realtime.messages` allowing `select` when `realtime.topic() = 'room:' || id` for a room where `is_room_member(id)`.

---

## 11. Realtime

- One **private** channel per room: `room:{roomId}`.
- Database triggers on `rooms` (update of status, round, host) and `players` (insert, update of status/submitted/spill_mode, delete) call `realtime.send(jsonb_build_object('roomId', ..., 'status', ..., 'at', now()), '<event>', 'room:' || room_id, true)`.
- Events: `room_changed`, `player_changed`, `nudge` (sent by the API via `realtime.send` in an RPC), `room_closed`.
- Clients treat every event as "refetch `/state`". The only payload read directly is `nudge.targetPlayerId` (shake + toast on that device) and `room_changed.revealed_at` (reveal sync).
- Presence (online dot in RoomPanel): Supabase Presence on the same channel keyed by `playerId`.
- Budget: one channel per room, no per-question messages. On Supabase Free, when concurrent connections approach the cap, turn on `polling_only`.

---

## 12. API (Next.js route handlers)

Base path `/api/v1`. JSON, camelCase. Auth via Supabase session cookie (`@supabase/ssr`), or `Authorization: Bearer` for tests. Every handler: zod-validate body, rate-limit, check membership/host/phase, call SQL function or service-role query, return the fresh state where useful. Errors: `{ "error": { "code": "ROOM_FULL", "message": "..." } }` with HTTP status. Every response has `x-request-id`.

| Method | Path | Who | Body → Response | Errors |
|---|---|---|---|---|
| GET | `/packs?band=` | anyone | → `Pack[]` (live with ≥1 live question, `questionCount`, `minAge`), only packs whose `minAge` the band reaches; no band means 13+ (SPIL-02) | |
| GET | `/rooms/:code/packs` | host | → `{packs, someHidden}`: packs for the room's youngest player (SPIL-02) | NOT_HOST |
| GET | `/packs/:id/preview?band=` | anyone | → `{questions}`: up to 3 questions marked `is_sample`, else the pack's first 3 live ones. The band must reach the pack's minimum age (SPIL-08) | PACK_UNAVAILABLE, PACK_NOT_ALLOWED |
| POST | `/rooms` | session + Turnstile | `{ageBand, packId, mode?}` → `{code}` (room in lobby, no player yet; `rooms.min_age` from the pack; mode defaults to classic) | RATE_LIMITED (10/h/user), PACK_UNAVAILABLE, AGE_TOO_YOUNG, PACK_NOT_ALLOWED, MODE_UNAVAILABLE |
| GET | `/rooms/:code` | anyone | → `{code, status, pack:{name,icon,isAdult,heat,minAge}, hostNickname, playerCount, maxPlayers, minAge, ageLockHours}` | ROOM_NOT_FOUND, ROOM_EXPIRED |
| POST | `/rooms/:code/join` | session | `{nickname, avatar, ageBand}` → `{playerId}`. First player becomes host. A band below `rooms.min_age` is refused before any player row exists | ROOM_FULL, GAME_STARTED, ROOM_EXPIRED, NAME_TAKEN, NAME_INVALID, AGE_TOO_YOUNG, AGE_RESTRICTED |
| GET | `/rooms/:code/state` | member | → `RoomState` (below) | NOT_IN_ROOM |
| PATCH | `/rooms/:code/pack` | host, lobby | `{packId}` → state. The pack must suit the youngest player; updates `rooms.min_age` | NOT_HOST, WRONG_PHASE, PACK_NOT_ALLOWED |
| POST | `/rooms/:code/start` | host, lobby | `{}` → state (calls `start_round`) | NOT_HOST, NOT_ENOUGH_PLAYERS, PACK_NOT_ALLOWED |
| PUT | `/rooms/:code/answers` | member, answering, not submitted | `{answers:[{questionId, value:'yes'\|'no'\|'skip'}]}` → `{saved}` | WRONG_PHASE, ALREADY_SUBMITTED, UNKNOWN_QUESTION |
| POST | `/rooms/:code/answers/submit` | member | `{}` → state. When all active players submitted → `advance_room(answering→guessing)` | INCOMPLETE |
| PUT | `/rooms/:code/guesses` | member, guessing | `{guesses:[{targetId, value}]}` → `{saved}` | WRONG_PHASE, INVALID_TARGET |
| POST | `/rooms/:code/guesses/submit` | member | `{}` → state. When all submitted → `advance_room(guessing→ready)` | INCOMPLETE |
| POST | `/rooms/:code/advance` | host | `{from}` → state. answering/guessing force-advance marks unfinished players `sat_out`; `ready→revealed` computes results with `lib/game/results.ts` then `save_results` | NOT_HOST, WRONG_PHASE |
| POST | `/rooms/:code/skip-to-reveal` | host, guessing, 60 s after guessing opened | `{}` → state. Locks everyone still guessing with the guesses they have; the room moves to ready (SPIL-01) | NOT_HOST, WRONG_PHASE, TOO_EARLY |
| POST | `/rooms/:code/reveal/next` | host, revealed | `{expected}` → state. Moves every phone to the next reveal slide; ignored when `expected` is stale, refused before the slide has had its time (SPIL-11) | NOT_HOST, WRONG_PHASE, TOO_EARLY |
| POST | `/rooms/:code/reveal/skip` | host, revealed | `{}` → state. Ends the reveal on every phone (SPIL-11) | NOT_HOST, WRONG_PHASE |
| PUT | `/rooms/:code/ratings` | member, answering, Hot Takes | `{ ratings: [{ questionId, value 0 to 100 }] }` → `{ saved, answered }`. Broadcasts progress like answers | WRONG_PHASE, ALREADY_SUBMITTED, UNKNOWN_QUESTION |
| PUT | `/rooms/:code/votes` | member, answering, Most Likely To | `{ votes: [{ questionId, targetId }] }` → `{ saved, answered }`. One vote per prompt, never yourself; broadcasts progress | WRONG_PHASE, ALREADY_SUBMITTED, UNKNOWN_QUESTION, INVALID_TARGET |
| PUT | `/rooms/:code/ranks` | member, answering, Rank the Room | `{ ranks: [{ questionId, order: [playerId] }] }` → `{ saved, answered }`. Each order is everyone in the game once, top first; a new order replaces the old | WRONG_PHASE, ALREADY_SUBMITTED, UNKNOWN_QUESTION, INVALID_TARGET |
| PUT | `/rooms/:code/suspect` | member, guessing, Imposter | `{ targetId }` → `{ saved }`. One vote, never yourself; a new vote replaces the old | WRONG_PHASE, ALREADY_SUBMITTED, INVALID_TARGET |
| PUT | `/rooms/:code/pick` | member, answering, Two Truths | `{ truths: [q, q], spill: q }` → `{ saved }`. Truths answered yes, spill answered no | WRONG_PHASE, ALREADY_SUBMITTED, INVALID_PICK |
| PUT | `/rooms/:code/spots` | member, guessing, Two Truths | `{ spots: [{ targetId, questionId }] }` → `{ saved }`. One spot per card, never your own | WRONG_PHASE, ALREADY_SUBMITTED, INVALID_TARGET |
| PUT | `/rooms/:code/texts` | member, answering, Who Said That? | `{ texts: [{ questionId, body }] }` → `{ saved }` (the filtered text). Slurs and contact details refused, swear words masked | WRONG_PHASE, ALREADY_SUBMITTED, UNKNOWN_QUESTION, TEXT_BLOCKED, TEXT_CONTACT, TEXT_EMPTY |
| PUT | `/rooms/:code/whose` | member, guessing, Who Said That? | `{ guesses: [{ answerId, authorId }] }` → `{ saved }`. Others' answers only, never yourself as author | WRONG_PHASE, ALREADY_SUBMITTED, INVALID_TARGET |
| POST | `/rooms/:code/answers/:answerId/report` | member | `{ reason? }` → `{ hidden: true }`. Hides the answer for everyone and files an answer report | NOT_FOUND, RATE_LIMITED |
| PUT | `/rooms/:code/spill-vote` | member, revealed, Spill or Skip | `{ questionId, targetId }` or `{ skip: true }` → state. Only Spill Mode players' yeses; one vote per player | WRONG_PHASE, INVALID_TARGET |
| PUT | `/rooms/:code/spill-answer` | the picked player, revealed, Spill or Skip | `{ spill }` → state. Tell the story or pass | WRONG_PHASE, FORBIDDEN |
| POST | `/rooms/:code/tv` | host, party_mode flag | `{}` → `{ token }`. Pairs a big screen; the same token after the first time | NOT_HOST, FEATURE_OFF |
| GET | `/rooms/:code/tv?t=` | no account, token | → TvState: room, players, results; never per-player fields | TV_NOT_PAIRED, FEATURE_OFF, RATE_LIMITED |
| POST | `/rooms/:code/react` | member, revealed | `{ emoji }` → `{}`. One of six fixed emoji, broadcast as `reaction`, never stored | BAD_REQUEST, WRONG_PHASE, RATE_LIMITED (30/min/player) |
| GET | `/stats/public` | none | → `{ roomsThisWeek }`, rooms whose reveal started in the last 7 days. Cached 10 minutes (SPIL-22) | |
| GET | `/daily` | session | → `{ day, question, mine, share, total }`. Share only once 10 answered and after I answer | |
| POST | `/daily` | session | `{ value: yes or no }` → the same. One answer a day; a second keeps the first | BAD_REQUEST, RATE_LIMITED |
| GET | `/crews` | session | → my crews `[{ id, name, members }]` | |
| POST | `/crews` | host, revealed room | `{ roomCode, name }` → `{ id, token }`. Saves the group; only the host joins; records the round | NOT_HOST, WRONG_PHASE, TEXT_BLOCKED, TEXT_CONTACT |
| POST | `/crews/join` | session | `{ token, nickname }` or `{ roomCode }` → `{ id }` | NOT_FOUND, ROOM_FULL, TEXT_BLOCKED |
| GET | `/crews/invite/:token` | none | → `{ name, members }` | NOT_FOUND |
| GET | `/crews/:id?season=` | member | → season table, seasons, recent rounds, members, invite token | NOT_FOUND |
| POST | `/crews/:id/leave` | member | → `{}` | NOT_FOUND |
| GET | `/me/badges` | session | → `{ stats, achievements: [{ id, unlocked, progress, target }], frames, looks, equipped: { frame, look } }` | |
| PATCH | `/me/cosmetics` | session | `{ frame?, look? }` → the same. Only unlocked ones | BAD_REQUEST, RATE_LIMITED |
| GET | `/rooms/:code/custom` | host | → the host's own questions `[{ id, text }]` | NOT_HOST |
| POST | `/rooms/:code/custom` | host, lobby, everyone 18+, yes or no game | `{ text }` → the list. Filtered, 8 to 120 characters, up to 30 | NOT_HOST, WRONG_PHASE, CUSTOM_ADULTS_ONLY, TEXT_BLOCKED, TEXT_CONTACT, BAD_REQUEST |
| DELETE | `/rooms/:code/custom/:id` | host, lobby | → the list | NOT_HOST, WRONG_PHASE |
| POST | `/rooms/:code/custom/use` | host, lobby, 5 or more questions | → state. The room plays them and becomes 18+ | NOT_HOST, CUSTOM_ADULTS_ONLY, BAD_REQUEST |
| PUT | `/rooms/:code/percent` | member, guessing, Room Percentage or Hot Takes | `{ guesses: [{ questionId, value 0 to 100 }] }` → `{ saved, total }`. Only questions 3 or more answered or rated | WRONG_PHASE, ALREADY_SUBMITTED, UNKNOWN_QUESTION |
| POST | `/rooms/:code/kick` | host, lobby | `{playerId}` → state | NOT_HOST, WRONG_PHASE |
| POST | `/rooms/:code/nudge` | host | `{playerId}` → `{}` (1 per target per minute) | RATE_LIMITED |
| PATCH | `/rooms/:code/me` | member | `{spillMode?, hideNameOnCard?, nickname?, avatar?}` → state | |
| DELETE | `/rooms/:code/me` | member | → `{}` (deletes own answers, guesses; marks left; host passes to earliest active player) | |
| POST | `/rooms/:code/rematch` | host, revealed | `{packId?}` → state (lobby, round+1). No pack: same pack and count, the one-tap Rematch (SPIL-18) | NOT_HOST |
| POST | `/rooms/:code/series/reset` | host, revealed | → state. The series starts again from the next round (SPIL-18) | NOT_HOST, WRONG_PHASE |
| POST | `/rooms/:code/test-players` | host, non-prod flag | `{count}` → state | FORBIDDEN |
| POST | `/reports` | session | `{type, questionId?, playerId?, roomCode?, reason}` → `{}` (10/h) | |
| POST | `/messages` | anyone + Turnstile | `{name?, email?, body}` → `{}` (5/h/IP) | |
| GET | `/api/cron/expire` | Vercel Cron (`Authorization: Bearer ${CRON_SECRET}`) | runs `expire_rooms()` | 401 |
| GET | `/api/health` | anyone | `{ok:true}` after `select 1` | |
| * | `/api/v1/admin/*` | admin by role | packs, questions (CRUD, bulk CSV import/export), reports, messages, rooms (list, close), settings, admins, audit, overview stats | 401, 403 |

`RoomState`:
```ts
type RoomState = {
  room: { code: string; status: RoomStatus; round: number; pack: PackSummary; revealedAt?: string; settings: { minPlayers: number; maxPlayers: number } };
  me: { id: string; isHost: boolean; ageConfirmed: boolean; answersSubmitted: boolean; guessesSubmitted: boolean; spillMode: boolean; hideNameOnCard: boolean };
  players: Array<{ id: string; nickname: string; avatar: number; rotationSeed: number; isHost: boolean; status: PlayerStatus; answered: number; answersSubmitted: boolean; guessesSubmitted: boolean; online?: boolean }>;
  questions?: Array<{ id: string; text: string }>;          // only during answering, for this round
  myAnswers?: Record<string, "yes" | "no" | "skip">;
  myGuesses?: Record<string, number>;
  results?: { rows: ResultRow[]; awards: AwardResult[]; questionStats: QuestionStat[] };  // only when revealed
};
```
`questionStats` only includes questions with 3+ answers; `spillNames` lists only players with Spill Mode on.

---

## 13. Game logic (port to `lib/game`, 100% unit-tested)

### 13.1 Codes, draw, rotation
- Room code: 4 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, crypto-random, retry on collision with a live room.
- Draw: unique random live questions from the pack, count = `settings.questions_per_game` (or all if fewer). Hidden and draft questions are never drawn.
- Sticker rotation: `ROT = [-4,-3,-2,-1,1,2,3,4]`, `rotation = ROT[rotation_seed % 8]` (seed random at join).

### 13.2 Spill Score
`score = round(100 × yes ÷ (yes + no))`; skips are excluded; 0 if nothing answered. Max skips 10% of the round's questions (`SKIP_LIMIT`).

### 13.3 Labels (shape and tone from HANDOFF)

| Range | Label | Sticker |
|---|---|---|
| 0 to 15 | Fresh Out The Box | ink, square |
| 16 to 35 | Mostly Innocent | raised, pill |
| 36 to 55 | Been Around | accent, tag |
| 56 to 75 | Main Character | accent, pill, condensed |
| 76 to 100 | Legendary Menace | ink, square, condensed caps |

### 13.4 Guesses, Mind Reader, awards
- `avgGuessAbout(p)` = round(mean of others' guesses about p); if none, equals p's score.
- `mindReader(p)` = round(mean over p's guesses of (100 − abs(guess − target score))); 0 if no guesses.
- Players marked `sat_out` for answers are excluded from scoring and guessing targets; `sat_out` for guesses still get a score.
- Awards in fixed reveal order, each given to exactly one player:

| # | Award | Rule | Tie-break | Icon / tone / shape |
|---|---|---|---|---|
| 1 | Top Spiller | highest score | earliest answers submit | Drop · accent · circle |
| 2 | Saint of the Room | lowest score | earliest answers submit | HandsPraying · inverse · rounded 40 |
| 3 | Mind Reader | highest mindReader | earliest guesses submit | Eye · raised · circle |
| 4 | Dark Horse | largest (score − avgGuessAbout) | larger absolute gap, then earliest join | Horse · inverse · circle |
| 5 | Open Book | smallest abs(score − avgGuessAbout) | earliest join | BookOpen · accent · rounded 40 |
| 6 | Clueless | lowest mindReader | latest guesses submit | Question · raised · circle |

Award reason copy comes from the prototype (e.g. "Highest score in the room. 82 out of 100.", "The room guessed 40. Kofi scored 71.").

- Rank: by score descending; ties share rank.
- `results.ts` exports `computeResults(input): { rows, awards, questionStats }`, pure and deterministic.

### 13.5 Phase rules
- Start needs `min_players` active players and, for adult packs, every player `age_confirmed`.
- All active players submit answers → `guessing`. All submit guesses → `ready`. Host taps Reveal → `revealed`.
- Host may force `answering→guessing` or `guessing→ready` after a confirm listing unfinished players.
- Join allowed only in `lobby`, under `max_players`, room not closed and under 24 h old.
- Host leaves or inactive 10 min (no `last_seen_at` heartbeat; client pings `/state` every 30 s) → host passes to earliest-joined active player.

---

## 14. Motion implementation

Implement exactly the HANDOFF motion table. Rules:

- Curves as CSS vars: `--ease-out: cubic-bezier(.23,1,.32,1)`, `--ease-in-out: cubic-bezier(.77,0,.175,1)`, `--ease-drawer: cubic-bezier(.32,.72,0,1)`. Never ease-in for entrances.
- Animate only `transform`, `opacity`, `clip-path`. Never height or width.
- Question card: `useMotionValue(x)`, `rotate = useTransform(x, v => clamp(v/14, -12, 12))`; flick when `abs(x) > 96` or (`abs(x) > 24` and velocity > 0.11 px/ms); flick to ±520 + fade 200 ms; return 320 ms `cubic-bezier(.34,1.3,.64,1)`; next card rises from `scale .96, y 10, opacity 0`.
- Reveal ceremony (`RevealStage`): 700 ms intro; for each player ascending by score: count-up 1400 ms easeOutCubic integer steps with the vessel rising, 150 ms, label `sticker-slap` (480 to 520 ms), 1200 ms hold, 450 ms gap; then each award: 550 ms beat, slap, 1900 ms hold. Skip jumps to Results. Use a single timeline driven by `requestAnimationFrame` writing to motion values (never React state per frame). Total about 33 s for 7 players.
- Not animated: screen changes, theme colour swap, slider thumb, tab switches, hover (colour only).
- `prefers-reduced-motion`: keep opacity and colour, drop movement, cards swap instantly, final scores appear without counting, beats stay, wave stops. Use `useReducedMotion()` from Motion and the CSS block in `tokens.css`.

---

## 15. Accessibility

WCAG 2.2 AA in both themes (NFR-AC-01). Rules from HANDOFF: 48x48 targets; meaning never by colour alone (Yes/No icon + word, statuses icon + word); `--line-strong` on input edges; focus ring 3 px accent; slider semantics as section 6.6; dialogs trap focus and close on Escape; reveal has Skip and `aria-live` announcements ("Ama scored 64, Main Character"). Run axe in Playwright on every route in both themes.

---

## 16. Share cards and Open Graph

- One `ShareCard` React component renders three formats: `story` 1080x1920, `square` 1080x1080, `og` 1200x630. It includes print texture, score with Vessel fill, label sticker, one award, wordmark and the link text **spil-party.vercel.app**. Hide-my-name shows "Anonymous player".
- Personal and group cards: render the component off-screen at 1x, `await document.fonts.ready`, capture with `modern-screenshot` (`domToPng`), then `navigator.share({ files: [png] })` when `navigator.canShare` allows, else download. Link shared: `https://spil-party.vercel.app/r/{code}?ref=share&utm_source=card`.
- Open Graph (server): `app/og/r/[code]/route.tsx` uses `ImageResponse` from `next/og` with a simplified card (solid colours, no blend modes, fonts loaded as ArrayBuffer from `/public/fonts`). Default site OG at `app/og/route.tsx`. `generateMetadata` on `/` and `/r/[code]` points to them. Cache `s-maxage=3600`.

---

## 17. Admin console

Matches `design/SPIL Admin.dc.html`. Utilitarian, same tokens, both themes.

| Section | Features | Roles |
|---|---|---|
| Overview | games started/finished today and 7 days, joins, completion rate, games started per pack (chart), "Needs a look" (open reports, new messages), Export CSV | all |
| Rooms | live rooms list (code, pack, status, players, age), close room | owner, moderator |
| Packs | list, create, edit (name, blurb, icon, tone, adult + heat, region, status, order), delete | owner, content_lead |
| Questions | filter by pack/status, edit text, status live/draft/hidden, yes rate and answered counts, bulk CSV import/export | owner, content_lead (moderator: hide only) |
| Reports | open/actioned/dismissed, hide question, remove player, dismiss | owner, moderator |
| Inbox | contact messages, mark read, archive | owner, moderator |
| Audit log | every admin action (who, action, target, time), last 300 visible, all stored | all (read) |
| Settings | questions per game, max players, min players, feature flags; admin accounts (add with temporary password, change role, remove, reset password); edit my details; change my password | owner (own details: everyone) |

"Reset all data" from the prototype is **dev/staging only**. Every write inserts into `audit_log`. Initial owner is created by a one-off script from env `INITIAL_OWNER_EMAIL` (not hard-coded).

---

## 18. Security

- Service-role key only in server code (`lib/supabase/admin.ts` imports `server-only`). CI scans the client build for the key.
- RLS on every table; CI fails if any `public` table has RLS disabled.
- Rate limits via `check_rate_limit`: room create 10/h/user, join 30/h/user, answer writes 300/min/player, reports 10/h, messages 5/h/IP, admin login 5/15 min.
- Turnstile on anonymous sign-in, room create and contact form.
- Nickname filter (`lib/validation/profanity.ts`, English + common West African slurs list maintained by Content Lead) on join and rename.
- Headers in `next.config.ts`: CSP (self, Supabase URL, PostHog, Sentry, Turnstile), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (no camera, mic, geolocation).
- No answer content in logs, analytics or Sentry (scrub `answers`, `guesses` from breadcrumbs).
- Data retention per SRS 12.2: rooms and all player data deleted after 7 days.

---

## 19. Testing

| Layer | What | Gate |
|---|---|---|
| Unit (Vitest) | `lib/game/*`: score, labels, mindReader, awards with ties, codes, draw, rotation, results; zod schemas | 90% coverage on `lib/game` |
| DB (pgTAP) | every RLS rule in section 10; `advance_room` race (two calls, one wins); `save_results` idempotent; `start_round` resets; `expire_rooms` | all pass |
| API integration | every endpoint success + each error code against local Supabase | all pass |
| E2E (Playwright, mobile 390 + desktop 1280, both themes) | full game with 3, 7 and 12 players (multiple browser contexts); host leaves; force advance; adult age gate; offline answer queue; rematch with pack switch; share card generation; admin moderation | smoke on every PR, full nightly |
| Accessibility | axe on every route, both themes | zero serious/critical |
| Performance | Lighthouse CI on `/`, `/join`, `/r/[code]` (mobile, Fast 3G): LCP < 2.5 s, INP < 200 ms, CLS < 0.1; room JS < 150 KB gz | budgets met |

Port all 37 checks from `design/SPIL Tests.dc.html` as named tests (Vitest for logic, Playwright for flows), keeping their names:

Content seed: packs seeded with adult ones flagged; every pack has live questions; picker shows only live packs with questions. Host: code is 4 chars with no ambiguous letters; room draws questions-per-game; questions unique. Guests: valid code passes; unknown rejected; four players in lobby; host removes a player; full room blocks joining; started room blocks late joiners. Answering: skips do not count; score is yes / answered; everyone done → guessing. Guessing and results: all guesses in → ready; room guess is average of others; six awards given; Top Spiller is highest; Saint is lowest; question stats cover every question (3+ answered rule in production); Spill Mode names only opted-in players; finishing counts once even if called twice; answer stats recorded. Rematch: clears answers and guesses; switching to an adult pack leaves players unconfirmed; new questions from the new pack. Test players: finish answering; finish guessing. Admin: hidden questions never drawn; draft packs disappear from picker; packs with no live questions disappear; questions-per-game setting respected; closed rooms count as expired; rooms older than 24 h expire; a deleted seed pack stays deleted; initial owner account exists.

---

## 20. Analytics and monitoring

- PostHog events (typed in `lib/analytics/events.ts`), as SRS 14.2: `landing_viewed`, `room_created`, `room_link_opened`, `player_joined`, `game_started`, `answers_submitted`, `guesses_submitted`, `phase_forced`, `room_revealed`, `share_clicked`, `spill_mode_toggled`, `rematch_started`, `question_reported`, `error_shown`, `theme_changed`. Never include answer or question text. Respect consent banner where required.
- Sentry: client + server, `tracesSampleRate: 0.1`, alerts at error rate > 2% for 5 min.
- Vercel Analytics + Speed Insights on.
- Uptime monitor (free tier) on `/api/health`.

---

## 21. Environment variables

| Name | Scope | Example |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | client + server | `https://spil-party.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | client / server | |
| `CRON_SECRET` | server | random 32 bytes |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | client | |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | server/CI | |
| `INITIAL_OWNER_EMAIL` | script only | the owner's email |
| `APP_ENV` | server | `local` \| `preview` \| `production` |

Commit `.env.example` with names only. Never commit values.

---

## 22. Build plan for Claude Code

Each milestone ends with: tests green, lint/typecheck clean, a commit (Conventional Commits, authored as WISDOMSKA (SENYA), no AI co-author lines) and a short note in `docs/PROGRESS.md`.

1. **Scaffold.** `pnpm create next-app` (TypeScript, App Router, ESLint, no src dir), Tailwind v4, Prettier, Vitest, Playwright, Supabase CLI init, `/design` committed, `CLAUDE.md` (section 23), `.env.example`, CI workflow skeleton. Vercel project `spil-party` linked; production domain `spil-party.vercel.app`.
2. **Design foundation.** tokens.css + spil-theme.css, fonts, theme script and toggle, Grain, z-index scale, `messages/en.json` with all prototype copy. A hidden `/dev/kitchen-sink` page (non-prod) showing every component in both themes.
3. **Components.** Everything in section 6.6 with all states, matched against `design/SPIL Components.dc.html`. Avatars ported from `SPIL Avatar.dc.html`.
4. **Database.** Migrations (section 9), RLS (section 10), SQL functions, seed (`classic`, `campus`, `work`, `groupchat`, `roadtrip` live; adult packs `afterdark`, `sheets`, `kink`, `nolimits` live with heat; `purity` as **draft** pending rewrite), pgTAP tests.
5. **Pure game logic.** `lib/game/*` + unit tests + the 37 named checks that are logic-level.
6. **API.** All route handlers (section 12), rate limits, Turnstile, integration tests.
7. **Static and entry screens.** Landing, Join, Pack picker, Profile, How to play, Privacy, Terms, Contact (with form), error pages, OG images.
8. **Room flow.** Lobby (realtime, presence, kick), Question (drag, keyboard, offline queue), Waiting (nudge, force), Guess, Ready, desktop RoomPanel.
9. **Reveal and results.** RevealStage choreography, Results tabs, Spill Mode, question stats, Rematch, Share sheet and cards.
10. **Admin.** Login/reset, 8 sections, roles, audit log, CSV import/export.
11. **Hardening.** Security headers, CSP, Sentry, PostHog, Lighthouse budgets, axe, full E2E, cron, keep-alive, test players gated off in production.
12. **Release.** Production Supabase migrated, env vars set on Vercel, smoke test on `https://spil-party.vercel.app`, tag `v1.0.0`.

---

## 23. `CLAUDE.md` (create at repo root)

```markdown
# SPIL: rules for working in this repo
- Spec: docs/TECH_SPEC.md (architecture, data, API, build order). Product rules: docs/SRS.md. Visual reference: /design (open the .dc.html files in a browser). Engineering rules: design/handoff/HANDOFF.md.
- React 19 + Next.js App Router + TypeScript strict + Tailwind v4 + Radix + Motion + Supabase. Do not add other UI kits, icon sets or CSS-in-JS.
- Colours, type, radii, spacing and motion come only from app/styles/tokens.css and spil-theme.css. No hex values in components.
- One accent. Only stickers rotate. One liquid moment per screen. No spinners. No em or en dashes in UI copy. All copy in messages/en.json.
- Game rules live in lib/game and must stay pure and tested. Clients never compute scores or change phases; the API does.
- Service-role key only in server code. Every table has RLS and a pgTAP test.
- Run `pnpm typecheck && pnpm lint && pnpm test` before every commit; `pnpm e2e:smoke` before every PR.
- Git: commits authored as WISDOMSKA (SENYA). Never add Co-Authored-By trailers, "Generated with" footers or any AI attribution in commits, PRs, code or docs.
- Production URL: https://spil-party.vercel.app
```

---

## 24. CI (`.github/workflows/ci.yml`)

On pull request and push to `main`:
1. `pnpm install --frozen-lockfile` (cache).
2. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, dash and hex greps.
3. `pnpm test --coverage`.
4. `supabase start`, `supabase db reset`, `supabase test db`, API integration tests.
5. `pnpm build`, bundle-size check, secret scan of `.next/static`.
6. Vercel preview deploy (Git integration) → Playwright smoke + axe + Lighthouse CI against the preview URL.
7. On `main`: `supabase db push` to production (protected `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`), then Vercel production deploy to `spil-party.vercel.app`.

`keepalive.yml`: cron every 3 days, `curl -fsS https://spil-party.vercel.app/api/health`.

---

## 25. Open items

| # | Item | Owner |
|---|---|---|
| 1 | Replace "The Purity 100" pack with original questions and a new name before it goes live | Content Lead |
| 2 | Pack glyphs are Phosphor placeholders inside sticker discs; replace with the custom flat glyph illustrations when ready | Design |
| 3 | Mood board / landing photography slots need real images | Design |
| 4 | Privacy and Terms copy is draft; legal review needed (Ghana Act 843, NDPA 2023, GDPR basics) | PO / Legal |
| 5 | Confirm `max_players` default 12 vs SRS 20 after beta | PO |
| 6 | Confirm questions-per-game default (12) after beta play-tests | PO |
| 7 | Upgrade Vercel to Pro and Supabase to Pro before payments (v1.1) | PO / DevOps |
