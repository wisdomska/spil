# Decisions

Decisions not covered by docs/TECH_SPEC.md, the SRS or the design. Newest last.

| Date       | Decision                                                                              | Why                                                                                      |
| ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2026-10-22 | Next.js 16.4 (latest stable) instead of 15                                            | Spec says "15+, latest stable"; 16 is current.                                           |
| 2026-10-22 | Staging Supabase project is named `spil-preview` (spec section 4 says `spil-staging`) | Matches the `preview` branch name the owner chose.                                       |
| 2026-10-22 | Licence: all rights reserved, `UNLICENSED` in package.json                            | Owner default.                                                                           |
| 2026-10-22 | Repo is private                                                                       | Owner choice. E2E full suite runs nightly to stay inside the 2,000 free Actions minutes. |
