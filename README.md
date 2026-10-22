# SPIL

A mobile-first party game. A host starts a private room and shares the link, friends join with a nickname, everyone privately answers "Have you ever..." questions, guesses each other's Spill Score, then watches an animated reveal with awards and shares a result card.

- Production: https://spil-party.vercel.app (admin at `/admin`)
- Staging: https://spil-party-preview.vercel.app

## Stack

Next.js (App Router) + React 19 + TypeScript strict, Tailwind v4 on the SPIL design tokens, Radix primitives, Motion, TanStack Query, zustand, zod, Supabase (Postgres, RLS, anonymous and email auth, Realtime), Vitest, Playwright, pgTAP. Hosted on Vercel Hobby and Supabase Free.

Docs: [technical spec](docs/TECH_SPEC.md), [requirements](docs/SRS.md), [decisions](docs/DECISIONS.md), [progress](docs/PROGRESS.md), [open items](docs/OPEN_ITEMS.md). Visual reference lives in [`design/`](design/) (open the `.dc.html` files in a browser; serve with `npx serve design`).

## Local setup

Requires Node 24 (`.nvmrc`), pnpm 10 and the Supabase CLI.

```bash
pnpm install
cp .env.example .env.local   # fill from the spil-preview project, see below
pnpm dev
```

`.env.local` values: Supabase URL and keys from the `spil-preview` project (Dashboard, Project Settings, API keys), or pull them with `vercel env pull .env.local --environment preview`.

## Scripts

| Script                              | What it does                                                       |
| ----------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                          | Dev server on http://localhost:3000                                |
| `pnpm build` / `pnpm start`         | Production build and server                                        |
| `pnpm typecheck`                    | Route type generation + `tsc --noEmit`                             |
| `pnpm lint`                         | ESLint                                                             |
| `pnpm format` / `pnpm format:check` | Prettier                                                           |
| `pnpm check:copy`                   | Fails on em/en dashes in copy and hex colours outside `app/styles` |

## Environment variables

See [`.env.example`](.env.example) and spec section 21. Never commit values. Vercel holds production values (`spil-prod`) and preview values (`spil-preview`); `scripts/sync-env.mjs` copies Supabase keys into Vercel without printing them.

## Deploy flow

Feature branch → PR into `preview` (deploys to the staging URL) → PR `preview` → `main` (deploys to production). Migrations are applied by CI to the matching Supabase project. See [CONTRIBUTING.md](CONTRIBUTING.md) for the squash and rebase-merge rules that keep authorship clean.
