# Progress

Milestones follow docs/TECH_SPEC.md section 22.

| #   | Milestone                      | Status      | Notes                                                                                                                          |
| --- | ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Skills, tooling, design import | done        | All 7 skill sources installed into `.claude/skills`. Design unzipped to `/design`; SRS converted to `docs/SRS.md` with pandoc. |
| 1   | Scaffold                       | in progress | Next.js 16.4, React 19.3, Tailwind v4, pnpm. Authorship guards (hook + settings + CI).                                         |
| 2   | Design foundation              | pending     |                                                                                                                                |
| 3   | Components                     | pending     |                                                                                                                                |
| 4   | Database                       | pending     |                                                                                                                                |
| 5   | Game logic                     | pending     |                                                                                                                                |
| 6   | API                            | pending     |                                                                                                                                |
| 7   | Static and entry screens       | pending     |                                                                                                                                |
| 8   | Room flow                      | pending     |                                                                                                                                |
| 9   | Reveal and results             | pending     |                                                                                                                                |
| 10  | Admin                          | pending     |                                                                                                                                |
| 11  | Hardening                      | pending     |                                                                                                                                |
| 12  | Release                        | pending     |                                                                                                                                |

## Environment notes

- No Docker on the dev machine (owner decision). Local DB and API tests run against the `spil-preview` Supabase project; CI runs the full local Supabase stack (GitHub runners have Docker).
- Supabase CLI is the standalone Windows binary in `~/bin` (the npm package failed to download its binary on this network); CI uses `supabase/setup-cli`.
