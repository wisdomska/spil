# Decisions

Decisions not covered by docs/TECH_SPEC.md, the SRS or the design. Newest last.

| Date       | Decision                                                                              | Why                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-22 | Next.js 16.4 (latest stable) instead of 15                                            | Spec says "15+, latest stable"; 16 is current.                                                                                      |
| 2026-10-22 | Staging Supabase project is named `spil-preview` (spec section 4 says `spil-staging`) | Matches the `preview` branch name the owner chose.                                                                                  |
| 2026-10-22 | Licence: all rights reserved, `UNLICENSED` in package.json                            | Owner default.                                                                                                                      |
| 2026-10-22 | Repo is private                                                                       | Owner choice. E2E full suite runs nightly to stay inside the 2,000 free Actions minutes.                                            |
| 2026-10-22 | Node 24 LTS (`.nvmrc`, Vercel `24.x`) instead of Node 20                              | Node 20 reached end of life in April 2026; 24 is the current LTS and Vercel's default.                                              |
| 2026-10-22 | Rebase merges only, branches squashed locally first                                   | GitHub authors squash and merge commits itself ("Senya" noreply address). Local squash keeps `wisdomska(senya)` as the only author. |
| 2026-10-22 | Dependabot PRs are adopted as owner-authored commits, never merged                    | Bot-authored commits would break the single-author rule.                                                                            |
| 2026-10-22 | Supabase projects in eu-west-2 (London), Vercel functions in `lhr1`                   | Closest free-tier regions to West Africa; same region keeps DB round trips short.                                                   |
