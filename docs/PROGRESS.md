# Progress

Milestones follow docs/TECH_SPEC.md section 22.

| #   | Milestone                      | Status  | Notes                                                                                                                          |
| --- | ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Skills, tooling, design import | done    | All 7 skill sources installed into `.claude/skills`. Design unzipped to `/design`; SRS converted to `docs/SRS.md` with pandoc. |
| 1   | Scaffold                       | done    | Next.js 16.4, React 19.3, Tailwind v4, pnpm. Authorship guards (hook + settings + CI).                                         |
| 2   | Design foundation              | done    |                                                                                                                                |
| 3   | Components                     | done    |                                                                                                                                |
| 4   | Database                       | done    |                                                                                                                                |
| 5   | Game logic                     | done    |                                                                                                                                |
| 6   | API                            | done    | All section 12 endpoints, rate limits, Turnstile hook, 19 integration tests (local Supabase in CI, spil-preview locally)       |
| 7   | Static and entry screens       | done    |                                                                                                                                |
| 8   | Room flow                      | done    |                                                                                                                                |
| 9   | Reveal and results             | done    |                                                                                                                                |
| 10  | Admin                          | done    | Console with 8 sections and roles, admin API with audit log, CSV import/export, create-owner script, admin integration tests   |
| 11  | Hardening                      | pending |                                                                                                                                |
| 12  | Release                        | pending |                                                                                                                                |

## Environment notes

- No Docker on the dev machine (owner decision). Local DB and API tests run against the `spil-preview` Supabase project; CI runs the full local Supabase stack (GitHub runners have Docker).
- Supabase CLI is the standalone Windows binary in `~/bin` (the npm package failed to download its binary on this network); CI uses `supabase/setup-cli`.
