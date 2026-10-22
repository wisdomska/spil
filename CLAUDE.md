# SPIL: rules for working in this repo

- Spec: docs/TECH_SPEC.md (architecture, data, API, build order). Product rules: docs/SRS.md. Visual reference: /design (open the .dc.html files in a browser). Engineering rules: design/handoff/HANDOFF.md.
- React 19 + Next.js App Router + TypeScript strict + Tailwind v4 + Radix + Motion + Supabase. Do not add other UI kits, icon sets or CSS-in-JS.
- Colours, type, radii, spacing and motion come only from app/styles/tokens.css and spil-theme.css. No hex values in components.
- One accent. Only stickers rotate. One liquid moment per screen. No spinners. No em or en dashes in UI copy. All copy in messages/en.json.
- Game rules live in lib/game and must stay pure and tested. Clients never compute scores or change phases; the API does.
- Service-role key only in server code. Every table has RLS and a pgTAP test.
- Run `pnpm typecheck && pnpm lint && pnpm test` before every commit; `pnpm e2e:smoke` before every PR.
- Git: commits authored as wisdomska(senya). Never add Co-Authored-By trailers, "Generated with" footers or any AI attribution in commits, PRs, code or docs. The commit-msg hook enforces this.
- Branches: feat/_, fix/_, chore/\* → PR into `preview` → PR `preview` → `main`. Squash merges, Conventional Commits.
- Production URL: https://spil-party.vercel.app

@AGENTS.md
