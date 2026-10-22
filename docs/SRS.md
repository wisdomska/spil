# SPIL – Software Requirements Specification

Oct 22, 2026 · @𝖘𝖊𝖓𝖞𝖆

## 1. Introduction

SPIL is a mobile-first web party game. Friends join a private room, privately answer yes/no "have you ever" questions, guess each other's scores, and reveal the results together. This SRS defines everything a team needs to design, build, test, launch and run version 1.0 on a \$0 starting budget.

### 1.1 Document control

| Field     | Value                                     |
|-----------|-------------------------------------------|
| Product   | SPIL                                      |
| Document  | Software Requirements Specification (SRS) |
| Version   | 1.0 (draft)                               |
| Owner     | Product Owner (WISDOMSKA / SENYA)         |
| Approvers | Product Owner, Tech Lead, Design Lead     |
| Status    | Draft for team review                     |

### 1.2 Purpose

- Give every role a single source of truth for what SPIL does, how it behaves, and how success is measured.

- Define scope for MVP (v1.0) and what is deferred to later releases.

- Provide testable requirements with IDs so work can be traced from requirement to ticket to test.

### 1.3 Scope

**In scope for v1.0 (MVP)**

- Anonymous play with a nickname (no account needed).

- Room Mode: create, join by link or code, answer, guess, reveal.

- Six launch question packs (one 18+ pack behind an age gate).

- Server-side scoring, leaderboard, awards, shareable result card.

- Basic admin tools for packs, questions and reports.

- Analytics, error monitoring and privacy controls.

**Deferred (v1.1+)**

- Party Mode (live, one question at a time).

- Paid packs and payments (Paystack, Stripe).

- Custom packs written by users.

- Optional accounts, history and friends lists.

- Native mobile apps (iOS, Android).

- Localisation beyond English.

### 1.4 Definitions

| Term | Meaning |
|----|----|
| Room | A private game session with a unique code and link |
| Host | The player who created the room and controls its phases |
| Player | Anyone who joined a room with a nickname |
| Pack | A themed set of questions (e.g. Campus Life) |
| Spill Score | A player's score, 0 to 100: the percentage of questions answered "yes" |
| Guess | One player's prediction of another player's Spill Score |
| Reveal | The phase where scores, guesses and awards are shown |
| Share card | A generated image summarising results for social media |
| MVP | Minimum viable product, the v1.0 scope above |
| RLS | Row Level Security, Postgres access rules enforced by Supabase |
| MoSCoW | Priority scale: Must, Should, Could, Won't (this release) |

### 1.5 References

- IEEE 830 / ISO/IEC/IEEE 29148 structure for requirements documents.

- WCAG 2.2 AA for accessibility.

- Ghana Data Protection Act, 2012 (Act 843); Nigeria Data Protection Act 2023; EU GDPR (for any EU visitors).

- Vercel, Supabase and Next.js official documentation (current versions at build time).

- Conversation notes: product concept, name choice (SPIL) and free-tier hosting decision.

## 2. Product overview

SPIL turns the solo "purity test" format into a group game: the fun is in guessing how much your friends have done, then the reveal. Growth comes from the room link (every game recruits new players) and the share card (every reveal advertises SPIL).

### 2.1 Vision and goals

- **Vision:** the go-to game friend groups open when they're together or in a group chat.

- **Goal 1:** 10,000 rooms created within 90 days of launch.

- **Goal 2:** at least 60% of rooms reach the Reveal phase.

- **Goal 3:** at least 25% of revealed rooms produce a shared card.

- **Goal 4:** run at \$0 hosting cost until revenue starts.

### 2.2 Problem statement

Existing purity-style tests are single-player web pages. Friends screenshot and compare scores manually in group chats. There is no shared room, no guessing game, no privacy control over individual answers, and no content that feels local to West African users.

### 2.3 Target users and personas

| Persona | Age | Context | Needs |
|----|----|----|----|
| Ama, university student | 19–24 | Hostel friend group, WhatsApp and TikTok heavy | Quick, funny, shareable, works on a mid-range Android phone |
| Kofi, young professional | 23–30 | Office friends, after-work hangouts | Office pack, private answers, no signup |
| Zainab, party host | 20–30 | Birthdays, house parties | Easy setup for 5–15 people, big reveal moment |
| Tunde, content creator | 18–28 | Films group reactions for TikTok | Visually strong reveal screen and share card |

Primary markets: Ghana and Nigeria first, then the wider English-speaking world. Minimum age: 13 for standard packs, 18 for spicy packs.

### 2.4 Operating environment

- **Clients:** mobile browsers first (Chrome Android, Safari iOS, Samsung Internet, Opera Mini excluded), then desktop browsers (Chrome, Safari, Edge, Firefox; last 2 versions).

- **Network:** must work on 3G and unstable mobile data; tolerate brief disconnects.

- **Devices:** design baseline is a 360×800 screen, 3 GB RAM Android phone.

- **Hosting:** Vercel (Hobby plan at start), Supabase (Free plan at start).

### 2.5 Constraints

- \$0 budget for hosting until monetisation; must fit Vercel Hobby and Supabase Free limits.

- Vercel Hobby plan is for non-commercial use: the team must move to Vercel Pro before taking payments.

- Supabase Free projects pause after a period of inactivity and cap realtime connections; the design must degrade gracefully (polling fallback).

- Serverless functions cannot hold websocket connections; realtime goes through Supabase Realtime.

- All GitHub commits and attributions are made to WISDOMSKA (SENYA).

### 2.6 Assumptions and dependencies

- Players have a smartphone with a modern browser and can open links from WhatsApp, Snapchat or Instagram.

- Most rooms have 3–10 players; the hard cap is 20.

- Question content is written in-house; no third-party content licences are needed.

- Dependencies: Vercel, Supabase, GitHub, Sentry (free), PostHog or Vercel Analytics (free), a domain registrar (optional).

## 3. Team roles and responsibilities

The MVP needs ten roles. In a small team one person can hold several roles (suggested pairings at the end), but every responsibility below must have a named owner before Sprint 1.

| Role | Owns | Key tasks | Main deliverables |
|----|----|----|----|
| Product Owner (PO) | Vision, scope, priorities | Maintain backlog; write and accept user stories; decide trade-offs; sign off releases; track KPIs | Prioritised backlog, release sign-off, KPI review |
| Project / Delivery Manager (Scrum Master) | Process and timeline | Run sprint planning, standups, reviews, retros; manage risks and blockers; keep the roadmap current | Sprint plans, burndown, risk log |
| UX/UI Designer | Experience and visual identity | User flows; wireframes; hi-fi mockups in Figma; design system (colours, type, components); share-card templates; motion specs; usability tests | Figma file, design tokens, prototype, usability report |
| Content Lead / Question Writer | All question packs | Write and edit questions per guidelines (Section 7); tag level and category; local editions; review reported questions | 6 launch packs (50 questions each), style guide |
| Tech Lead / Architect | Technical direction | Architecture; data model; code standards; code reviews; security design; performance budgets; free-tier limit planning | Architecture doc, ADRs, repo setup, review approvals |
| Frontend Engineer(s) | Client app | Build screens in Next.js + Tailwind; realtime subscriptions; state and offline handling; accessibility; animations; share-card rendering | Working UI, component library, frontend tests |
| Backend Engineer | Data and server logic | Supabase schema, migrations, RLS; API route handlers; scoring and awards; rate limiting; scheduled cleanup jobs; admin APIs | Migrations, API, backend tests |
| QA Engineer | Quality | Test plan; test cases traced to requirement IDs; manual device testing; automated E2E (Playwright); regression; bug triage | Test plan, test reports, release QA sign-off |
| DevOps Engineer | Environments and delivery | GitHub repo, branch rules, CI (GitHub Actions); Vercel and Supabase environments; secrets; monitoring (Sentry); backups; free-tier usage alerts | CI/CD pipeline, runbooks, dashboards |
| Growth / Marketing Lead | Launch and growth | Brand voice, TikTok/IG content, campus ambassadors, launch calendar, landing copy, analytics review with PO | Launch plan, content calendar, weekly growth report |

**Supporting roles (part-time or advisory)**

- **Legal / Privacy advisor:** reviews Privacy Policy, Terms, age gate and data retention against Ghana Act 843, NDPA 2023 and GDPR.

- **Trust & Safety moderator:** reviews reported questions and abuse reports within 48 hours.

- **Community manager (post-launch):** runs socials, replies to feedback, collects feature requests.

### 3.1 RACI for key activities

R = Responsible, A = Accountable, C = Consulted, I = Informed.

| Activity | PO | PM | Design | Content | Tech Lead | FE | BE | QA | DevOps | Growth |
|----|----|----|----|----|----|----|----|----|----|----|
| Scope and priorities | A | C | C | C | C | I | I | I | I | C |
| UX flows and UI | A | I | R | C | C | C | I | C | I | C |
| Question packs | A | I | I | R | I | I | I | C | I | C |
| Architecture and data model | C | I | I | I | A/R | C | R | I | C | I |
| Frontend build | I | I | C | I | A | R | C | C | I | I |
| Backend, scoring, RLS | I | I | I | I | A | C | R | C | C | I |
| Testing and QA sign-off | C | I | I | I | C | C | C | A/R | I | I |
| CI/CD and environments | I | I | I | I | A | C | C | C | R | I |
| Privacy and safety | A | I | C | C | R | C | R | C | I | I |
| Launch and growth | A | C | C | C | I | I | I | I | I | R |
| Release go/no-go | A | R | C | C | C | I | I | C | C | C |

### 3.2 Minimum team pairings

- **Solo founder:** PO + Content + Growth; one full-stack engineer covers FE + BE + DevOps; QA via friends' beta testing.

- **Team of 4:** PO/Growth, Designer/Content, Full-stack (FE focus), Full-stack (BE + DevOps + QA automation).

- **Team of 6+:** one person per core role; PM and QA can be shared or part-time.

## 4. Game design and rules

A room moves through five phases (Lobby, Answering, Guessing, Revealed, Expired), and only the host can move it forward. Scores are computed on the server; no client ever receives another player's individual answers unless that player opted in.

### 4.1 Room lifecycle

1.  **Lobby:** host creates the room and picks a pack; players join with a nickname and avatar. Minimum 3 players to start, maximum 20.

2.  **Answering:** each player answers every question in the pack privately (yes/no). A player can change an answer until they press Submit. The host sees "X of N done".

3.  **Guessing:** each player guesses every other player's Spill Score with a 0–100 slider. Starts automatically when all players submit, or when the host forces it (players who haven't finished are marked "sat out").

4.  **Revealed:** scores, guesses and awards appear in an animated sequence; the share card is generated. Starts when all guesses are in, or the host forces it.

5.  **Expired:** 7 days after creation, the room and all its answers are deleted automatically.

Late joiners can join during Lobby only. A player who leaves mid-game keeps their submitted data; if the host leaves, host rights pass to the earliest-joined remaining player.

### 4.2 Scoring

- **Spill Score** = round(100 × yes answers ÷ questions answered). Range 0–100. Higher = has done more.

- **Score labels** (shown on reveal and share card):

| Score  | Label             |
|--------|-------------------|
| 0–15   | Fresh Out The Box |
| 16–35  | Mostly Innocent   |
| 36–55  | Been Around       |
| 56–75  | Main Character    |
| 76–100 | Legendary Menace  |

- **Guess accuracy** for one guess = 100 − \|guess − actual score\|.

- **Mind Reader points** = average accuracy of all a player's guesses (0–100).

### 4.3 Awards (shown at reveal)

| Award | Rule | Tie-break |
|----|----|----|
| Top Spiller | Highest Spill Score | Earliest submit time |
| Saint of the Room | Lowest Spill Score | Earliest submit time |
| Mind Reader | Highest Mind Reader points | Earliest guess submit |
| Dark Horse | Largest positive gap: actual score minus average guess about them | Larger absolute gap |
| Open Book | Smallest gap between actual score and average guess about them | Earliest submit time |
| Clueless | Lowest Mind Reader points (only shown in rooms of 5+) | Latest guess submit |

Awards need at least 3 scored players. A player can win more than one award.

### 4.4 Privacy rules inside a room

- Default: only scores are shown, never individual answers.

- **Spill Mode (opt-in, per player):** after reveal, a player can choose to share their full answers with the room. It can be turned off again at any time.

- **Question stats:** after reveal, the room can see per-question counts (e.g. "4 of 6 said yes") only for questions where at least 3 players answered, so no single answer can be inferred.

### 4.5 Party Mode (v1.1, specified for planning)

- Host's screen shows one question at a time; everyone taps yes or no within 15 seconds.

- After each question: an anonymous count is shown ("5 of 8 said yes").

- Final scores and awards work as in Room Mode, without the guessing phase.

## 5. Functional requirements

The MVP has 63 functional requirements; every "Must" is required for launch. Each ID maps to tickets and test cases (Section 15). Priority uses MoSCoW.

### 5.1 Session and identity (ID)

| ID | Requirement | Priority |
|----|----|----|
| FR-ID-01 | The system shall create an anonymous Supabase session for every visitor on first action (create or join), with no email or phone required. | Must |
| FR-ID-02 | A player shall choose a nickname of 2–20 characters (letters, numbers, spaces, emoji) and an avatar from a set of at least 24. | Must |
| FR-ID-03 | Nicknames shall be unique within a room (case-insensitive); a duplicate gets a prompt to change it. | Must |
| FR-ID-04 | Nicknames shall pass a profanity and slur filter before saving. | Must |
| FR-ID-05 | The session shall persist on the device (refresh or reopen returns the player to their room). | Must |
| FR-ID-06 | A player shall be able to delete all their data from a room at any time ("Leave and delete my answers"). | Must |
| FR-ID-07 | Optional accounts (Google, Apple, email magic link) to keep history across devices. | Could (v1.2) |

### 5.2 Room management (RM)

| ID | Requirement | Priority |
|----|----|----|
| FR-RM-01 | A user shall create a room by choosing a pack and entering their nickname; they become host. | Must |
| FR-RM-02 | Each room shall get a unique 4-character code (A–Z, 2–9, excluding O, I, 0, 1) and a link /r/{code}. | Must |
| FR-RM-03 | The host shall be able to share the link via the native share sheet, WhatsApp deep link, and copy-to-clipboard. | Must |
| FR-RM-04 | The lobby shall update in real time as players join or leave (within 2 seconds). | Must |
| FR-RM-05 | The host shall be able to remove a player from the lobby. | Must |
| FR-RM-06 | The host shall start the game only when 3–20 players are present. | Must |
| FR-RM-07 | The host shall be able to force the next phase; a confirmation dialog shall list players who haven't finished. | Must |
| FR-RM-08 | If the host leaves or is inactive for 10 minutes, host rights shall pass to the earliest-joined active player. | Should |
| FR-RM-09 | Rooms shall expire and be hard-deleted 7 days after creation. | Must |
| FR-RM-10 | A user shall be able to start a "rematch" with the same players and a different pack. | Should |
| FR-RM-11 | A device shall be limited to 10 rooms created per hour. | Must |

### 5.3 Answering (AN)

| ID | Requirement | Priority |
|----|----|----|
| FR-AN-01 | Questions shall display one per screen with large Yes and No buttons and a progress bar. | Must |
| FR-AN-02 | Question order shall be the same for every player in a room (seeded shuffle per room). | Must |
| FR-AN-03 | A player shall be able to go back and change previous answers before submitting. | Must |
| FR-AN-04 | Answers shall auto-save to the server after each tap; an offline queue shall retry on reconnect. | Must |
| FR-AN-05 | A player shall submit once all questions are answered; after submit, answers are locked. | Must |
| FR-AN-06 | Swipe right (yes) and left (no) gestures shall work alongside buttons. | Should |
| FR-AN-07 | A "Skip" option shall exist; skipped questions are excluded from the score denominator, max 10% of the pack. | Should |

### 5.4 Guessing (GS)

| ID | Requirement | Priority |
|----|----|----|
| FR-GS-01 | Each player shall guess every other scored player's Spill Score with a 0–100 slider (step 1, default 50). | Must |
| FR-GS-02 | Guesses shall be hidden from everyone until reveal. | Must |
| FR-GS-03 | A player shall not see any real scores until reveal. | Must |
| FR-GS-04 | The waiting screen shall show who is done, and the host may send a "nudge" (in-app shake on that player's screen, max once per minute). | Should |

### 5.5 Reveal (RV)

| ID | Requirement | Priority |
|----|----|----|
| FR-RV-01 | Reveal shall show players from lowest to highest score with an animated count-up, then awards. | Must |
| FR-RV-02 | Each player's card shall show score, label, average guess about them, and their own Mind Reader points. | Must |
| FR-RV-03 | Awards shall follow the rules in Section 4.3. | Must |
| FR-RV-04 | All players' screens shall start the reveal within 2 seconds of each other. | Should |
| FR-RV-05 | After reveal, players may opt in to Spill Mode to share their answers (Section 4.4). | Should |
| FR-RV-06 | Per-question stats shall show only where 3+ players answered. | Should |
| FR-RV-07 | Results shall remain viewable via the room link until expiry. | Must |

### 5.6 Sharing (SH)

| ID | Requirement | Priority |
|----|----|----|
| FR-SH-01 | The system shall generate a personal share card (1080×1920 PNG) with nickname, score, label, award and SPIL URL. | Must |
| FR-SH-02 | The system shall generate a group card (1080×1080) with the leaderboard. | Should |
| FR-SH-03 | Share uses the Web Share API with image file where supported, with download fallback. | Must |
| FR-SH-04 | Shared links shall carry Open Graph metadata so previews show on WhatsApp, X, iMessage. | Must |
| FR-SH-05 | Share links shall include a UTM/referral parameter to measure virality. | Must |
| FR-SH-06 | A player may hide their nickname on the card ("Anonymous player"). | Should |

### 5.7 Packs and content (PK)

| ID | Requirement | Priority |
|----|----|----|
| FR-PK-01 | The pack picker shall list active packs with name, emoji, description, question count and an 18+ badge where relevant. | Must |
| FR-PK-02 | Each pack shall have 30–60 questions (launch target 50). | Must |
| FR-PK-03 | Spicy packs shall require every player in the room to confirm they are 18+ before joining that room. | Must |
| FR-PK-04 | Packs and questions shall be stored in the database and editable without a deploy. | Must |
| FR-PK-05 | Packs may be flagged premium (locked until purchase, v1.1). | Could |
| FR-PK-06 | Packs may be region-tagged (e.g. GH, NG) and sorted first for users in that region. | Should |

### 5.8 Safety and reporting (SF)

| ID | Requirement | Priority |
|----|----|----|
| FR-SF-01 | Any player shall be able to report a question as offensive or unclear. | Must |
| FR-SF-02 | A question with 5+ reports shall be auto-hidden pending review. | Should |
| FR-SF-03 | Players shall be able to report a nickname; the host and admins can remove that player. | Must |
| FR-SF-04 | The age gate shall be shown before any spicy content and recorded per player per room. | Must |

### 5.9 Admin (AD)

| ID | Requirement | Priority |
|----|----|----|
| FR-AD-01 | Admins shall sign in with email + one-time code (Supabase Auth), restricted to an allow-list. | Must |
| FR-AD-02 | Admins shall create, edit, reorder, activate and deactivate packs and questions. | Must |
| FR-AD-03 | Admins shall review, resolve and act on reports. | Must |
| FR-AD-04 | Admins shall see a basic dashboard: rooms today, active rooms, completion rate, top packs. | Should |
| FR-AD-05 | All admin actions shall be written to an audit log. | Must |

### 5.10 Static pages and system (SY)

| ID | Requirement | Priority |
|----|----|----|
| FR-SY-01 | Landing page with "Create room" and "Join with code" above the fold. | Must |
| FR-SY-02 | How to Play, Privacy Policy, Terms of Use, and Contact pages. | Must |
| FR-SY-03 | Cookie/analytics consent banner where required by region. | Must |
| FR-SY-04 | Friendly error pages: room not found, room expired, room full, game already started. | Must |
| FR-SY-05 | Installable PWA (manifest, icons, offline shell). | Should |
| FR-SY-06 | Light and dark themes following the system setting. | Should |

## 6. User experience and interface

A first-time player must go from tapping a shared link to answering question 1 in under 30 seconds, using one thumb on a phone. Every screen below is required for MVP.

### 6.1 Core user flows

**Host flow:** Landing → Create room → Pick pack → Nickname + avatar → (Age confirm if spicy) → Lobby → Start → Answer → Submit → Guess → Wait → Reveal → Share / Rematch.

**Guest flow:** Shared link → Room preview (pack name, host, players) → Nickname + avatar → (Age confirm if spicy) → Lobby → Answer → Submit → Guess → Wait → Reveal → Share / "Host your own" CTA.

### 6.2 Screen inventory

| \# | Screen | Route | Key elements | States to design |
|----|----|----|----|----|
| 1 | Landing | / | Hero line, Create room, Join with code, 3-step how it works, sample share card | Default, returning player banner |
| 2 | Join with code | /join | 4-box code input, auto-advance, paste support | Invalid, expired, full, started |
| 3 | Pack picker | /create | Pack cards (emoji, name, count, 18+ badge, region tag) | Loading, locked premium (v1.1) |
| 4 | Profile setup | /r/{code}/me | Nickname field, avatar grid, age confirm (spicy) | Duplicate name, filtered name |
| 5 | Lobby | /r/{code} | Room code, share buttons, live player list, Start (host) | Waiting for players, ready, removed |
| 6 | Question | /r/{code}/play | Question text, Yes/No, back, progress, skip | Saving, offline, last question |
| 7 | Submitted / waiting | /r/{code}/play | "X of N done", player ticks, nudge (host), force next (host) | All done transition |
| 8 | Guess | /r/{code}/guess | Player card + slider for each player, submit | Partially complete |
| 9 | Reveal | /r/{code}/reveal | Animated leaderboard, award cards, Spill Mode toggle, question stats | Animating, static (revisit) |
| 10 | Share sheet | modal | Card preview, anonymous toggle, share/download | Generating, error |
| 11 | Error pages | various | Clear message + "Create a room" CTA | 404, expired, full, already started, offline |
| 12 | Static pages | /how, /privacy, /terms, /contact | Plain readable text | — |
| 13 | Admin | /admin/\* | Login, packs, questions, reports, dashboard, audit log | Empty, loading, error |

### 6.3 Design system

- **Personality:** cheeky, bold, warm; never mean. Think party, not nightclub.

- **Colour:** one bold primary (e.g. hot coral), one accent (electric yellow), neutral greys; full dark mode. All tokens defined in Figma and mirrored as Tailwind CSS variables.

- **Type:** one display font with character for scores and headings, one clean sans for body (both free, e.g. Google Fonts); minimum body size 16 px.

- **Components:** Button (primary, secondary, ghost, destructive), Card, Avatar, Slider, Progress bar, Toast, Modal, Code input, Pack card, Player chip, Award card, Score counter.

- **Motion:** answer tap feedback under 100 ms; reveal count-up 1.5 s per player; respect prefers-reduced-motion.

- **Haptics:** light vibration on answer tap and award reveal where supported.

- **Copy tone:** short, playful, second person. Examples: "Spill it.", "No take-backs after this.", "Waiting on Kofi… typical."

### 6.4 Accessibility (WCAG 2.2 AA)

- Colour contrast at least 4.5:1 for text, 3:1 for large text and controls.

- All controls reachable by keyboard and screen reader, with visible focus.

- Touch targets at least 48×48 px.

- Slider operable by buttons (−/+) as well as drag.

- Reveal animation has a skip button and honours reduced motion.

- Meaning never conveyed by colour alone; all images and avatars have alt text.

### 6.5 Design deliverables checklist

- [ ] User flow diagrams (host, guest, admin)

- [ ] Low-fi wireframes for all 13 screens

- [ ] Hi-fi mockups, mobile (360 px) and desktop (1280 px), light and dark

- [ ] Clickable prototype for usability testing

- [ ] Design tokens exported for Tailwind

- [ ] Share-card templates (personal 1080×1920, group 1080×1080, OG 1200×630)

- [ ] Logo, favicon, PWA icons (192, 512, maskable)

- [ ] 24+ avatar set

- [ ] Motion spec for reveal sequence

- [ ] Usability test with 5 users, findings report

## 7. Content: question packs

SPIL launches with six original packs of 50 questions each (300 total), written in-house. Questions are never copied from the Rice Purity Test or any other existing quiz.

### 7.1 Launch packs

| Pack | Audience | Level mix (mild / medium / spicy) | Age | Region |
|----|----|----|----|----|
| Classic | Everyone | 50% / 50% / 0% | 13+ | Global |
| Campus Life | Students | 40% / 60% / 0% | 13+ | Global |
| Office Hours | Working professionals | 50% / 50% / 0% | 13+ | Global |
| Online Life | Gen Z / internet culture | 50% / 50% / 0% | 13+ | Global |
| Chale & Naija Edition | West African friend groups | 40% / 60% / 0% | 13+ | GH, NG |
| After Dark | Adults | 0% / 40% / 60% | 18+ | Global |

### 7.2 Writing guidelines

1.  Every question starts with "Have you ever…" and must be answerable yes or no.

2.  Max 90 characters so it fits on one phone screen at 22 px.

3.  Ask about the player's own experiences, never about other named people.

4.  No questions about race, religion, ethnicity, disability, sexual orientation or gender identity as the subject of a joke.

5.  No questions that ask about crimes causing serious harm to others, self-harm, or anything involving minors in sexual contexts.

6.  Drug and alcohol questions only in the 18+ pack, and never framed as encouraging.

7.  Mix of funny, nostalgic and slightly embarrassing; at least 1 in 5 questions should get a big "yes" rate so everyone scores something.

8.  Local editions use real local references (trotro, jollof debates, WAEC, NYSP, Detty December) but stay understandable to outsiders.

9.  Each question is tagged: pack, level (mild, medium, spicy), category (social, romance, school, work, online, food, travel, chaos), and region.

### 7.3 Content workflow

1.  Writer drafts in a shared sheet using the template columns above.

2.  Second reviewer checks tone and guidelines; flags anything risky.

3.  PO approves the pack.

4.  Content is imported via an admin CSV upload or seed script.

5.  After launch: questions with high report counts or very low engagement (e.g. 99% "no") are reviewed monthly and replaced.

### 7.4 Sample questions (style reference)

- Have you ever laughed at a funeral?

- Have you ever pretended your phone was dead to avoid a call?

- Have you ever joined a work meeting from bed?

- Have you ever argued about whose jollof is better for more than 10 minutes?

- Have you ever sent a voice note longer than 5 minutes?

- Have you ever stalked an ex's new partner online?

## 8. System architecture and tech stack

SPIL is a single Next.js app on Vercel backed by Supabase. All trusted logic (phase changes, scoring, awards, limits) runs in Next.js route handlers or Postgres functions; the browser only reads what RLS allows and subscribes to live room events.

<img src="media/image1.png" style="width:6in;height:3.84821in" alt="SPIL system architecture · Vercel + Supabase" />

SPIL system architecture · Vercel + Supabase

Players load pages from Vercel and call its API for every write; live updates reach them straight from Supabase Realtime. Postgres is the single source of truth, and RLS uses the anonymous session's user ID to decide what each player can read.

### 8.1 Tech stack

| Layer | Choice | Why |
|----|----|----|
| Framework | Next.js (App Router), TypeScript strict | SSR for share previews, route handlers for API, first-class on Vercel |
| Styling | Tailwind CSS + CSS variables for tokens | Fast, consistent, dark mode |
| UI primitives | Radix UI (accessible), Framer Motion (reveal animations) | Accessibility and smooth motion |
| State | TanStack Query for server data; Zustand for local UI state | Caching, retries, offline queue |
| Validation | Zod (shared client/server schemas) | One schema for forms and API |
| Database | Supabase Postgres | Free tier, SQL, RLS |
| Auth | Supabase anonymous sign-in; email OTP for admins | No-signup play |
| Realtime | Supabase Realtime (Postgres changes + broadcast + presence) | Websockets that Vercel functions can't hold |
| Images | @vercel/og (Satori) | Share cards and OG images on the fly |
| Scheduled jobs | Vercel Cron (Hobby allows daily) + Postgres function | Room expiry |
| Rate limiting | Postgres-backed counters (Upstash Redis free tier as an option) | Abuse protection at \$0 |
| Monitoring | Sentry (free), Vercel logs | Errors and performance |
| Analytics | PostHog Cloud free tier or Vercel Web Analytics | Funnels and events |
| Testing | Vitest, React Testing Library, Playwright, pgTAP (RLS tests) | Unit, component, E2E, DB |
| CI/CD | GitHub Actions + Vercel Git integration | Preview deploy per PR |
| Payments (v1.1) | Paystack (GH/NG), Stripe (international) | Mobile money + cards |

### 8.2 Architecture principles

- **Server is the referee:** clients never compute scores or change phases directly; they call the API, which checks the host and phase.

- **Least privilege:** the browser uses the Supabase anon key with RLS; the service-role key exists only in server environment variables.

- **Realtime is a signal, not the truth:** on any realtime event the client refetches state from the API; if the socket drops, clients poll every 5 seconds.

- **Stateless functions:** no in-memory state on Vercel; everything lives in Postgres.

- **Free-tier aware:** one realtime channel per room, no per-question broadcasts, images cached at the edge.

### 8.3 Repository structure

spil/\
app/\
(marketing)/page.tsx \# landing, how, privacy, terms\
create/page.tsx\
join/page.tsx\
r/\[code\]/(lobby\|play\|guess\|reveal)/page.tsx\
admin/...\
api/rooms/... api/admin/... \# route handlers\
og/\[...\]/route.tsx \# share cards\
components/ \# UI components\
lib/ (supabase, scoring, awards, validation, analytics)\
supabase/migrations/ \# SQL migrations + RLS + functions\
supabase/seed/ \# packs and questions\
tests/ (unit, e2e, db)\
.github/workflows/

## 9. Data model

Ten Postgres tables hold all MVP data; every player-data table cascades from rooms, so deleting a room removes everything about it. All tables use UUID primary keys and timestamptz timestamps in UTC.

### 9.1 Tables

**packs**

| Column | Type | Notes |
|----|----|----|
| id | uuid PK |  |
| slug | text unique | e.g. campus-life |
| name | text |  |
| description | text | max 140 chars |
| emoji | text |  |
| is_spicy | boolean | requires 18+ |
| is_premium | boolean | v1.1 |
| price_minor | int null | price in minor units (pesewas/kobo/cents), v1.1 |
| region | text null | GH, NG, or null for global |
| sort_order | int |  |
| is_active | boolean |  |
| created_at, updated_at | timestamptz |  |

**questions**

| Column | Type | Notes |
|----|----|----|
| id | uuid PK |  |
| pack_id | uuid FK → packs |  |
| text | text | max 90 chars |
| level | enum mild, medium, spicy |  |
| category | text | social, romance, school, work, online, food, travel, chaos |
| is_active | boolean | false when hidden after reports |
| report_count | int | default 0 |
| created_at, updated_at | timestamptz |  |

**rooms**

| Column | Type | Notes |
|----|----|----|
| id | uuid PK |  |
| code | char(4) unique among non-expired | join code |
| pack_id | uuid FK → packs |  |
| host_player_id | uuid FK → players null | set after host joins |
| status | enum lobby, answering, guessing, revealed |  |
| question_seed | int | seeded shuffle for order |
| question_count | int | frozen at start |
| created_by | uuid | auth user id |
| created_at | timestamptz |  |
| started_at, guessing_at, revealed_at | timestamptz null | phase timestamps |
| expires_at | timestamptz | created_at + 7 days |

**players**

| Column | Type | Notes |
|----|----|----|
| id | uuid PK |  |
| room_id | uuid FK → rooms, on delete cascade |  |
| user_id | uuid | Supabase auth user (anonymous) |
| nickname | text | 2–20 chars, unique per room (case-insensitive) |
| avatar | text | avatar key |
| age_confirmed | boolean | required for spicy rooms |
| joined_at | timestamptz |  |
| answers_submitted_at | timestamptz null |  |
| guesses_submitted_at | timestamptz null |  |
| spill_mode | boolean | opt-in answer sharing |
| hide_name_on_card | boolean |  |
| status | enum active, left, removed, sat_out |  |
| Unique | (room_id, user_id) | one player per device per room |

**answers**

| Column      | Type                       | Notes     |
|-------------|----------------------------|-----------|
| player_id   | uuid FK → players, cascade | PK part 1 |
| question_id | uuid FK → questions        | PK part 2 |
| value       | enum yes, no, skip         |           |
| updated_at  | timestamptz                |           |

**guesses**

| Column     | Type                       | Notes                             |
|------------|----------------------------|-----------------------------------|
| guesser_id | uuid FK → players, cascade | PK part 1                         |
| target_id  | uuid FK → players, cascade | PK part 2; check guesser ≠ target |
| value      | smallint                   | 0–100                             |
| updated_at | timestamptz                |                                   |

**results** (written once by the server at reveal)

| Column             | Type                          | Notes            |
|--------------------|-------------------------------|------------------|
| player_id          | uuid PK FK → players, cascade |                  |
| room_id            | uuid FK → rooms, cascade      |                  |
| spill_score        | smallint                      | 0–100            |
| label              | text                          | from Section 4.2 |
| avg_guess_about    | smallint null                 |                  |
| mind_reader_points | smallint null                 |                  |
| awards             | text\[\]                      | award keys       |
| rank               | smallint                      |                  |

**reports**

| Column                  | Type                           | Notes           |
|-------------------------|--------------------------------|-----------------|
| id                      | uuid PK                        |                 |
| type                    | enum question, nickname, other |                 |
| question_id             | uuid null                      |                 |
| player_id               | uuid null                      | reported player |
| reason                  | text                           | max 280 chars   |
| reporter_user_id        | uuid                           |                 |
| status                  | enum open, actioned, dismissed |                 |
| created_at, resolved_at | timestamptz                    |                 |

**admins** — user_id (uuid PK), email, role (admin, moderator), created_at.

**audit_log** — id, admin_user_id, action, entity, entity_id, before (jsonb), after (jsonb), created_at.

**rate_limits** — key (text, e.g. create_room:{user_id}), window_start, count. Used by Postgres function check_rate_limit().

### 9.2 Row Level Security rules

| Table | Read | Write |
|----|----|----|
| packs, questions | Anyone (active rows only) | Admins only |
| rooms | Players in that room | Server (service role) only |
| players | Players in the same room (public columns via view) | Own row: nickname, avatar, spill_mode, hide_name_on_card; everything else server only |
| answers | Own answers only; others' only if their spill_mode = true and room is revealed | Own answers while room status = answering and not yet submitted |
| guesses | Own guesses; all guesses in the room after reveal | Own guesses while status = guessing |
| results | Players in that room after reveal | Server only |
| reports | Admins only | Any authenticated user can insert |
| admins, audit_log, rate_limits | Admins / server only | Server only |

### 9.3 Indexes, jobs and retention

- Indexes: rooms(code) where expires_at \> now(), players(room_id), answers(player_id), guesses(target_id), questions(pack_id, is_active).

- expire_rooms() Postgres function deletes rooms where expires_at \< now(); called daily by Vercel Cron (or Supabase pg_cron if available).

- Anonymous auth users with no room activity for 30 days are deleted by the same job.

- Backups: Supabase Free has no point-in-time recovery; content tables (packs, questions) are also exported weekly to the GitHub repo as seed files by CI.

## 10. API and realtime specification

All writes go through versioned JSON route handlers under /api/v1; each call carries the player's Supabase access token as a Bearer header, is validated with Zod, and is rate limited. Reads that RLS allows may go straight to Supabase from the client.

### 10.1 Conventions

- JSON in and out; UTF-8; camelCase fields.

- Auth: Authorization: Bearer \<supabase access token\> (anonymous or admin).

- Errors: { "error": { "code": "ROOM_FULL", "message": "This room already has 20 players." } } with the matching HTTP status.

- Idempotency: answer and guess writes are upserts, safe to retry.

- Every response includes x-request-id for log tracing.

### 10.2 Endpoints

| Method | Path | Who | Purpose | Main errors |
|----|----|----|----|----|
| GET | /api/v1/packs | Anyone | List active packs | — |
| POST | /api/v1/rooms | Any session | Create room {packId, nickname, avatar, ageConfirmed} → {roomCode, playerId} | RATE_LIMITED, AGE_REQUIRED, NAME_INVALID |
| GET | /api/v1/rooms/{code} | Anyone | Room preview: pack, status, player count, host nickname | ROOM_NOT_FOUND, ROOM_EXPIRED |
| POST | /api/v1/rooms/{code}/join | Any session | Join {nickname, avatar, ageConfirmed} → {playerId} | ROOM_FULL, GAME_STARTED, NAME_TAKEN, AGE_REQUIRED |
| GET | /api/v1/rooms/{code}/state | Room player | Full state for this player: phase, players, progress, own answers/guesses, results if revealed | NOT_IN_ROOM |
| POST | /api/v1/rooms/{code}/start | Host | Lobby → answering | NOT_HOST, NOT_ENOUGH_PLAYERS |
| PUT | /api/v1/rooms/{code}/answers | Player | Upsert answers \[{questionId, value}\] | WRONG_PHASE, ALREADY_SUBMITTED |
| POST | /api/v1/rooms/{code}/answers/submit | Player | Lock answers | INCOMPLETE, SKIP_LIMIT |
| PUT | /api/v1/rooms/{code}/guesses | Player | Upsert guesses \[{targetId, value}\] | WRONG_PHASE, INVALID_TARGET |
| POST | /api/v1/rooms/{code}/guesses/submit | Player | Lock guesses | INCOMPLETE |
| POST | /api/v1/rooms/{code}/advance | Host | Force next phase; computes results on reveal | NOT_HOST, WRONG_PHASE |
| POST | /api/v1/rooms/{code}/kick | Host | Remove a player in lobby {playerId} | NOT_HOST, WRONG_PHASE |
| POST | /api/v1/rooms/{code}/nudge | Host | Nudge a player {playerId} | RATE_LIMITED |
| PATCH | /api/v1/rooms/{code}/me | Player | Update spill_mode, hide_name_on_card | — |
| DELETE | /api/v1/rooms/{code}/me | Player | Leave and delete own data | — |
| POST | /api/v1/rooms/{code}/rematch | Player | New room, same players invited {packId} | RATE_LIMITED |
| POST | /api/v1/reports | Any session | Report question or nickname | RATE_LIMITED |
| GET | /og/card/{code}/{playerId} | Anyone with link | Personal share card PNG | 404 |
| GET | /og/group/{code} | Anyone with link | Group card PNG | 404 |
| GET | /api/cron/expire | Vercel Cron (secret header) | Delete expired rooms and stale users | 401 |
| \* | /api/v1/admin/\* | Admin | CRUD packs/questions, list/resolve reports, stats | 401, 403 |

Phase changes and result computation run in a single Postgres transaction (advance_room(room_id, actor_id) function) so two hosts' taps or retries can't double-advance a room.

### 10.3 Realtime events

One Supabase channel per room: room:{roomId}. Messages are signals only; clients refetch /state after receiving them.

| Event | Source | Payload | Client action |
|----|----|----|----|
| player_joined / player_left | Postgres change on players | playerId | Refresh lobby |
| progress | Broadcast from API on submit | playerId, stage (answers or guesses) | Tick player as done |
| phase_changed | Broadcast from API | status, at | Navigate to next screen |
| nudge | Broadcast from API | targetPlayerId | Shake + toast on that device |
| room_closed | Broadcast | reason | Show error page |
| Presence | Supabase presence | playerId, online | Show online dot |

**Fallback:** if the channel is not joined within 5 seconds or drops, the client polls /state every 5 seconds until it reconnects.

## 11. Non-functional requirements

SPIL must feel instant on a mid-range Android phone over 3G and stay within free-tier limits until revenue. Each target below is measurable and checked before release.

| ID | Category | Requirement | How it's measured |
|----|----|----|----|
| NFR-PF-01 | Performance | Landing page LCP under 2.5 s, INP under 200 ms, CLS under 0.1 on Moto G-class device, Fast 3G | Lighthouse CI on every PR, Vercel Speed Insights |
| NFR-PF-02 | Performance | Initial JS for room pages under 150 KB gzipped | Bundle analyser in CI |
| NFR-PF-03 | Performance | Answer tap to visual feedback under 100 ms (optimistic UI); server save p95 under 500 ms | Sentry performance traces |
| NFR-PF-04 | Performance | Share card generated in under 2 s p95 | Route timing logs |
| NFR-RT-01 | Realtime | Lobby and phase updates delivered to all players within 2 s p95 | E2E test with 10 simulated players |
| NFR-SC-01 | Scalability | Support 200 concurrent active rooms (about 1,000 players) on free tiers via polling fallback when realtime limits are hit | Load test (k6) |
| NFR-SC-02 | Scalability | Architecture scales to 10,000 concurrent players by upgrading plans only, no code rewrite | Architecture review |
| NFR-AV-01 | Availability | 99.5% monthly uptime for core flows (best effort on free tiers) | Uptime monitor (e.g. free UptimeRobot / Better Stack) |
| NFR-AV-02 | Resilience | If Supabase is paused or down, show a friendly "We're waking up" page with retry, never a blank screen | Manual chaos test |
| NFR-SE-01 | Security | OWASP Top 10 addressed; zero critical findings before launch | Security checklist (Section 12) |
| NFR-PR-01 | Privacy | No answer data readable by anyone except as allowed in Section 9.2 | pgTAP RLS tests |
| NFR-AC-01 | Accessibility | WCAG 2.2 AA for all player screens | axe in Playwright + manual screen-reader pass |
| NFR-CO-01 | Compatibility | Works on last 2 versions of Chrome, Safari, Edge, Firefox, Samsung Internet; iOS 16+, Android 10+ | BrowserStack free / device lab |
| NFR-US-01 | Usability | 4 of 5 first-time testers complete a full game without help | Usability test |
| NFR-MA-01 | Maintainability | TypeScript strict; ESLint + Prettier; 80% unit coverage on lib/scoring and lib/awards; 60% overall | CI coverage report |
| NFR-MA-02 | Maintainability | Every DB change ships as a migration; no manual schema edits in production | CI check |
| NFR-OB-01 | Observability | All server errors captured in Sentry with request ID; alerts on error rate over 2% for 5 minutes | Sentry alert rules |
| NFR-CS-01 | Cost | \$0/month hosting until monetisation; alert at 80% of any free-tier quota | Weekly usage review by DevOps |
| NFR-LO-01 | Localisation | All UI strings in one translation file (next-intl) so new languages need no code change | Code review |
| NFR-SEO-01 | SEO | Landing and static pages server-rendered with titles, meta descriptions, OG tags, sitemap.xml and robots.txt; room pages noindex | Lighthouse SEO score 95+ |

## 12. Security, privacy, safety and legal

SPIL holds sensitive personal confessions, so privacy is the product's core promise: collect almost nothing, show only scores by default, and delete everything after 7 days. A breach of answer data would end the product, so these controls are launch blockers.

### 12.1 Security controls

- [ ] Service-role key and all secrets only in Vercel environment variables; never in client bundles (CI check greps the build).

- [ ] RLS enabled on every table; a CI test fails if any table has RLS off.

- [ ] All API inputs validated with Zod; reject unknown fields.

- [ ] Rate limits: room create 10/hour/device; join 30/hour/device; reports 10/hour; answer writes 300/minute/player; admin login 5/15 min.

- [ ] Bot protection on room creation (Cloudflare Turnstile free, invisible mode) if abuse is seen.

- [ ] Security headers: strict CSP, HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy.

- [ ] Room codes are not secret; access to room data still requires being a joined player (RLS).

- [ ] Cron endpoint protected with a secret header (CRON_SECRET).

- [ ] Admin routes require an admin row and email OTP; admin sessions expire after 12 hours.

- [ ] Dependencies scanned with GitHub Dependabot and npm audit in CI.

- [ ] No user-generated HTML; all text rendered escaped.

### 12.2 Data we collect

| Data | Why | Retention |
|----|----|----|
| Anonymous auth ID | Link a device to its players | Deleted after 30 days of inactivity |
| Nickname, avatar | Show in room | Deleted with the room (7 days) |
| Answers, guesses, results | Core game | Deleted with the room (7 days) |
| Age confirmation flag | Gate 18+ packs | Deleted with the room |
| Reports | Moderation | 12 months, no answer data attached |
| Analytics events | Product improvement | Anonymous, no answers, 12 months |
| IP address | Rate limiting, abuse | Not stored beyond logs (Vercel log retention) |

Never collected: real names, email or phone (players), contacts, precise location, the text of any answer in analytics.

### 12.3 Safety

- Minimum age 13 (stated in Terms and on first play); spicy packs 18+ with explicit self-confirmation by every player in the room.

- Content guidelines in Section 7.2 prevent questions targeting groups or involving minors.

- Nickname filter plus report and remove tools.

- Clear in-app message: "Only your score is shared. Your answers stay private unless you choose Spill Mode."

- Moderation SLA: reports reviewed within 48 hours.

### 12.4 Legal documents (launch blockers)

- Privacy Policy covering Ghana Data Protection Act 2012 (Act 843), Nigeria Data Protection Act 2023 and GDPR basics; consider registering with the Ghana Data Protection Commission before monetisation.

- Terms of Use: age limits, acceptable use, no warranty, content ownership.

- Cookie and analytics consent where required.

- Trademark search for "SPIL" (WIPO Global Brand Database, Ghana Registrar-General) before spending on branding.

- Payment terms and refund policy before v1.1.

These should be reviewed by a qualified lawyer before launch; this SRS is not legal advice.

## 13. Monetisation and payments (v1.1)

v1.0 is completely free to maximise growth; payments switch on in v1.1 once at least 60% of rooms reach reveal and weekly rooms are growing. Before the first paid transaction, hosting moves to Vercel Pro and Supabase Pro.

### 13.1 Revenue streams

| Stream | What the user gets | Indicative price | Who pays |
|----|----|----|----|
| Premium pack | Unlock one themed pack for every room you host, forever | GHS 10 / NGN 1,500 / \$0.99 | Host |
| Pack bundle | All current premium packs | GHS 30 / NGN 4,500 / \$2.99 | Host |
| Room unlock: Who Said Yes | Per-question names for players who opted in to Spill Mode | GHS 5 / NGN 700 / \$0.49 per room | Any player |
| Custom pack | Write up to 30 own questions for a birthday, wedding or team event | GHS 25 / NGN 3,500 / \$1.99 | Host |
| Sponsored pack | A brand funds a free branded pack | Negotiated | Brands |

Prices are placeholders for the PO to test; show local currency by IP country.

### 13.2 Payment requirements

| ID | Requirement | Priority |
|----|----|----|
| FR-PY-01 | Paystack checkout for GHS and NGN (mobile money and cards). | Must (v1.1) |
| FR-PY-02 | Stripe Checkout for other currencies. | Should (v1.1) |
| FR-PY-03 | Purchases unlock only after a verified server-side webhook; never trust the client. | Must (v1.1) |
| FR-PY-04 | Purchases attach to an account, so v1.1 adds optional sign-in (Google, Apple, email) for buyers. | Must (v1.1) |
| FR-PY-05 | Restore purchases on a new device after sign-in. | Must (v1.1) |
| FR-PY-06 | Store orders in an orders table (id, user_id, product, amount_minor, currency, provider, provider_ref, status, created_at). | Must (v1.1) |
| FR-PY-07 | Refund handling via admin panel; refunds revoke unlocks. | Should (v1.1) |

No ads in v1.x; they would hurt the private, party feel and pay little at early scale.

## 14. Analytics, events and KPIs

The north-star metric is **rooms revealed per week**: it captures creation, invites and completion in one number. Events are anonymous and never include answer content.

### 14.1 KPIs and targets (first 90 days)

| KPI | Definition | Target |
|----|----|----|
| Rooms revealed / week | Rooms reaching revealed status | Grow 20% week on week |
| Room completion rate | Revealed ÷ started rooms | 60%+ |
| Avg players per room | Players with submitted answers | 5+ |
| Join conversion | Players who join ÷ unique room link visits | 70%+ |
| Share rate | Revealed rooms with 1+ share ÷ revealed rooms | 25%+ |
| Viral coefficient (K) | New hosts from a room's players ÷ rooms | Above 0.5, aim for 1.0 |
| Time to first question | Link open → question 1 shown | Under 30 s median |
| D7 host return | Hosts who host again within 7 days | 20%+ |

### 14.2 Event tracking plan

| Event | When | Properties |
|----|----|----|
| landing_viewed | Landing loads | referrer, utm_source, country |
| room_created | Create succeeds | pack_slug, is_spicy |
| room_link_opened | Room preview loads | room_status, ref (share/direct) |
| player_joined | Join succeeds | is_host, players_in_room |
| game_started | Host starts | player_count |
| answers_submitted | Player submits | duration_s, skips |
| guesses_submitted | Player submits | duration_s |
| phase_forced | Host forces next phase | from_status, unfinished_count |
| room_revealed | Reveal | player_count, total_duration_s |
| share_clicked | Share tapped | card_type, method (native/download/copy) |
| spill_mode_toggled | Toggle | on/off |
| rematch_started | Rematch | new_pack_slug |
| question_reported | Report | question_id, reason_type |
| error_shown | Any error page | error_code |

### 14.3 Dashboards

- **Growth funnel:** landing → room created → game started → revealed → shared.

- **Pack performance:** rooms and completion rate per pack.

- **Drop-off:** where players abandon (question number, guessing).

- **Health:** error rate, p95 latency, free-tier usage.

The PO and Growth Lead review the funnel weekly and pick one metric to improve each sprint.

## 15. Testing and QA strategy

Every "Must" requirement has at least one automated test, and nothing merges to main with failing tests. The QA Engineer owns the traceability matrix (requirement ID → test case ID → result).

### 15.1 Test levels

| Level | Tool | Scope | Owner | Runs |
|----|----|----|----|----|
| Unit | Vitest | Scoring, labels, awards, tie-breaks, validation schemas, code generator | FE/BE | Every PR |
| Component | React Testing Library | Buttons, slider, code input, question card, reveal states | FE | Every PR |
| Database | pgTAP / Supabase test helpers | RLS policies per table and role, advance_room, expire_rooms | BE | Every PR |
| API integration | Vitest + local Supabase | Every endpoint, success and each error code | BE | Every PR |
| End-to-end | Playwright (mobile viewport) | Full game with 3, 10 and 20 players; host leaves; force advance; spicy age gate | QA | Every PR (smoke), nightly (full) |
| Accessibility | axe-core in Playwright + manual VoiceOver/TalkBack | All player screens | QA | Every PR + before release |
| Performance | Lighthouse CI, k6 | Web vitals budgets; 200 concurrent rooms | QA/DevOps | Weekly + before release |
| Security | OWASP ZAP baseline, manual RLS abuse tests | API and headers | Tech Lead | Before release |
| Device | Real devices (budget Android, iPhone, Samsung) | Core flow on 3G throttle | QA | Before release |
| Usability | 5 real friend groups | Full game unaided | Designer | Beta week |

### 15.2 Critical test cases (must pass for launch)

1.  A player can never read another player's answers via the API or direct Supabase queries unless that player turned on Spill Mode after reveal.

2.  Scores and awards match hand-calculated results for 10 prepared fixture rooms, including ties.

3.  Two simultaneous "advance" taps move the room forward exactly one phase.

4.  A player who loses network mid-quiz keeps all saved answers and resumes on reconnect.

5.  A non-confirmed player cannot join a spicy room.

6.  Expired rooms and all their rows are deleted by the cron job.

7.  Room creation is blocked after 10 rooms in an hour from one device.

8.  Share card renders correctly for long nicknames, emoji and hidden-name mode.

### 15.3 Bug severity and release gate

| Severity | Example | Release rule |
|----|----|----|
| S1 Critical | Data leak, game cannot finish, site down | Blocks release; fix immediately |
| S2 Major | Wrong score, broken share, realtime fails without fallback | Blocks release |
| S3 Minor | Layout glitch on one device, typo in a question | Can ship with a ticket |
| S4 Trivial | Cosmetic polish | Backlog |

## 16. DevOps: environments, CI/CD and operations

Three environments (local, preview, production) with one-click rollback via Vercel. Supabase Free allows two projects, so preview deployments share a single "staging" Supabase project.

### 16.1 Environments

| Environment | Frontend | Database | Data | Who uses it |
|----|----|----|----|----|
| Local | next dev | Supabase CLI (Docker) | Seed packs + fixtures | Engineers |
| Preview / staging | Vercel preview deploy per PR | Supabase project spil-staging | Seed + test rooms | Team, QA, beta testers |
| Production | Vercel production (main) | Supabase project spil-prod | Real users | Everyone |

### 16.2 Git workflow

- Trunk-based: short-lived branches feat/\*, fix/\*, chore/\* off main.

- Conventional Commits (feat:, fix:, chore:); all commits authored and attributed to WISDOMSKA (SENYA) on the owner's account.

- main is protected: PR required, 1 approving review, all checks green, linear history.

- Releases tagged vMAJOR.MINOR.PATCH with a generated changelog.

### 16.3 CI pipeline (GitHub Actions)

1.  Install with cached dependencies.

2.  Typecheck, lint, format check.

3.  Unit and component tests with coverage.

4.  Start local Supabase; apply migrations; run pgTAP RLS tests and API integration tests.

5.  Build; check bundle size budget; secret-leak scan of the client build.

6.  Vercel preview deploy (Git integration); Playwright smoke + axe against the preview URL; Lighthouse CI.

7.  On merge to main: apply migrations to production Supabase (supabase db push with a protected token), then Vercel production deploy.

### 16.4 Configuration and secrets

| Variable | Where | Notes |
|----|----|----|
| NEXT_PUBLIC_SUPABASE_URL | Client + server | Public |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Client + server | Public, RLS-protected |
| SUPABASE_SERVICE_ROLE_KEY | Server only | Never exposed |
| CRON_SECRET | Server only | Protects cron route |
| SENTRY_DSN, SENTRY_AUTH_TOKEN | Server + CI | Error monitoring |
| NEXT_PUBLIC_POSTHOG_KEY | Client | Analytics |
| TURNSTILE_SECRET_KEY | Server only | If bot protection enabled |
| PAYSTACK_SECRET_KEY, STRIPE_SECRET_KEY, webhook secrets | Server only | v1.1 |

### 16.5 Monitoring and runbooks

- **Alerts:** Sentry error rate over 2% for 5 min; uptime check fails twice; Supabase usage over 80% of any free quota.

- **Keep-alive:** a scheduled ping keeps the production Supabase project from pausing during quiet periods (or upgrade to Pro).

- **Runbook: site down** → check Vercel status and deploy logs → roll back to last good deploy → check Supabase status/pause → post on socials if over 30 min.

- **Runbook: data leak suspected** → disable affected endpoint via feature flag → rotate keys → audit RLS → notify affected users and regulator as the law requires.

- **Runbook: free-tier limit hit** → enable polling-only mode flag → upgrade plan → review usage spike.

- **Feature flags:** simple feature_flags table read at request time (polling_only, spicy_packs_enabled, payments_enabled, party_mode).

## 17. Release plan, milestones and launch

The MVP is built in five two-week sprints and launches publicly in week 11; v1.1 (Party Mode and payments) follows in weeks 12–16. Each gate is a go/no-go meeting led by the PO.

<img src="media/image2.png" style="width:6in;height:5.65178in" alt="SPIL roadmap · 5 sprints, 3 gates, launch in week 11" />

SPIL roadmap · 5 sprints, 3 gates, launch in week 11

Weeks assume a team of about four; a solo builder should roughly double each sprint.

### 17.1 Definition of Done (every ticket)

- [ ] Code reviewed and merged to main with green CI

- [ ] Unit/integration tests added; linked requirement ID in the PR

- [ ] Works on mobile (360 px) and desktop, light and dark

- [ ] Accessibility checked (keyboard, labels, contrast)

- [ ] Analytics event added where the tracking plan requires it

- [ ] Strings in the translation file; no hard-coded copy

- [ ] Deployed to preview and verified by QA

### 17.2 Launch checklist

- [ ] Production Supabase migrated, RLS tests green against production schema

- [ ] Custom domain (optional), HTTPS, OG images verified on WhatsApp, X and iMessage

- [ ] Privacy Policy, Terms, How to Play live

- [ ] Sentry alerts and uptime monitor active

- [ ] Analytics funnel dashboard built

- [ ] Social accounts (TikTok, Instagram, X) reserved and 10 launch videos ready

- [ ] 10 campus ambassadors briefed with their own launch week plan

- [ ] Support email and feedback form working

- [ ] Rollback plan rehearsed

### 17.3 Go-to-market

- **Week -2:** private beta with 20 friend groups; collect reaction videos (with permission).

- **Launch week:** daily TikTok/Reels of real reveals; WhatsApp status push by the team and ambassadors.

- **Timing:** align with a social moment (new semester, Detty December, Valentine's) where possible.

- **Loop:** every share card and room link carries a referral tag; the best-performing pack and video format get doubled down on weekly.

## 18. Risks, acceptance criteria and open questions

The biggest risks are a privacy failure and a viral spike that breaks free-tier limits; both have mitigations that must be in place before launch.

### 18.1 Risk register

| Risk | Likelihood | Impact | Mitigation | Owner |
|----|----|----|----|----|
| Answer data exposed by an RLS mistake | Medium | Critical | pgTAP tests per policy, security review, minimal data, 7-day deletion | Tech Lead |
| Viral spike exceeds Supabase realtime or Vercel limits | Medium | High | Polling fallback flag, usage alerts at 80%, budget ready to upgrade within a day | DevOps |
| Supabase Free project pauses during quiet period | High | Medium | Keep-alive ping; friendly wake-up page | DevOps |
| Game used to bully or pressure someone | Medium | High | Scores-only default, opt-in Spill Mode, report and remove, content rules | PO / T&S |
| Minors accessing 18+ packs | Medium | High | Age gate for every player, spicy packs off by default, clear Terms | PO / Legal |
| Novelty fades after launch spike | High | Medium | New packs monthly, seasonal events, rematch, Party Mode in v1.1 | PO / Growth |
| Copycats launch similar apps | Medium | Medium | Ship fast, local packs, brand voice, community | Growth |
| Name "SPIL" conflicts with an existing trademark | Low–Medium | Medium | Trademark search before branding spend | PO |
| Vercel Hobby terms breached by monetising | Medium | Medium | Move to Vercel Pro before payments go live | PO / DevOps |
| Low completion because one friend never finishes | High | Medium | Host force-advance, nudges, "sat out" status | PO / Design |

### 18.2 MVP acceptance criteria

- [ ] All "Must" functional requirements (Section 5) pass their linked tests.

- [ ] All critical test cases (Section 15.2) pass in production-like staging.

- [ ] NFR performance, accessibility and security targets (Section 11) met.

- [ ] 5 beta friend groups each complete a full game unaided; average rating 4/5 or higher.

- [ ] Legal pages live; privacy promise visible in the app.

- [ ] Monitoring, alerts, analytics dashboards and runbooks live.

- [ ] PO, Tech Lead and QA sign the go/no-go.

### 18.3 Open questions

| \# | Question | Owner | Needed by |
|----|----|----|----|
| 1 | Final brand: is the domain (e.g. spil.app, getspil.com) and social handles available? | PO | Sprint 0 |
| 2 | Is the Spill Score shown as "higher = done more", or should the purity-style "100 = innocent" be offered as an option? | PO / Design | Sprint 0 |
| 3 | Minimum players: 3 (current) or 2 for couples mode? | PO | Sprint 1 |
| 4 | PostHog or Vercel Analytics as the single analytics tool? | Tech Lead | Sprint 1 |
| 5 | Which local languages or Pidgin variants for v1.2 packs? | Content | v1.1 |
| 6 | Exact prices per market after beta feedback | PO / Growth | v1.1 |
| 7 | Register with the Ghana Data Protection Commission before or at monetisation? | Legal | v1.1 |
