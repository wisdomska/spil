# Operations

How SPIL runs, deploys and recovers. Everything here is on free tiers.

## Environments

| Environment | URL                                   | Branch    | Supabase project                        |
| ----------- | ------------------------------------- | --------- | --------------------------------------- |
| Production  | https://spil-party.vercel.app         | `main`    | `spil-prod` (`vhrtnirvvkiybxjufmsm`)    |
| Staging     | https://spil-party-preview.vercel.app | `preview` | `spil-preview` (`cambebifktqgnbthumzq`) |
| PR previews | `spil-party-git-<branch>-…vercel.app` | any PR    | `spil-preview`                          |
| Local       | http://localhost:3000                 | any       | `spil-preview` via `.env.local`         |

Admin console: `/admin` on each environment.

## Release flow

1. Work on a feature branch, open a PR into `preview`.
2. CI (`.github/workflows/ci.yml`) runs authorship, typecheck, lint, format, copy rules, unit tests
   with coverage, build, the service-role leak scan, pgTAP and the API tests. Vercel builds a PR preview.
3. When green, squash the branch to one commit authored by the owner and fast-forward `preview` to it
   (`git push origin <branch>:refs/heads/preview`). GitHub marks the PR merged. See `CONTRIBUTING.md`.
4. The push to `preview` runs `.github/workflows/deploy.yml`: migrations and auth settings go to
   `spil-preview`, then, once Vercel serves the new commit (`/api/version`), Lighthouse, the security
   header check, the bundle key scan and the Playwright smoke test run against the staging URL.
5. Release: PR `preview` into `main`, fast-forward `main`, tag `vX.Y.Z`. The same deploy workflow then
   migrates `spil-prod` and verifies production.

The deploy workflow needs the `SUPABASE_ACCESS_TOKEN` repository secret (a Supabase personal access
token). Without it, the migrate job prints a warning and skips; apply migrations by hand (below).

## Secrets and environment variables

Names are listed in `.env.example`. Values live only in Vercel, GitHub secrets and `.env.local`.

- Vercel env (production and preview): `node scripts/sync-env.mjs` pushes them through the Vercel API.
  Server-only values are stored as sensitive.
- GitHub secrets: `SUPABASE_ACCESS_TOKEN`, `PREVIEW_ANON_KEY`, `PROD_ANON_KEY`.
  Set with `gh secret set NAME` (it prompts, so the value never lands in shell history).
- Optional telemetry: `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` turn Sentry on, `NEXT_PUBLIC_POSTHOG_KEY`
  turns PostHog on, `NEXT_PUBLIC_VERCEL_ANALYTICS=1` loads Vercel Web Analytics and Speed Insights
  (enable both in the Vercel dashboard first, or their scripts 404).
- Turnstile: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Without them, room creation
  and joining skip the captcha (rate limits still apply).

Rotate a secret: create the new value at the provider, update Vercel (`sync-env.mjs`) and GitHub
(`gh secret set`), redeploy (`vercel --prod` or push), then revoke the old value.

## Database

- Migrations: `supabase/migrations`, applied in order. Never edit an applied migration; add a new one.
- Manual apply: `supabase link --project-ref <ref>` then `supabase db push --linked`.
  Add `--include-seed` only on a fresh project (the seed loads packs and questions).
- Auth settings: `node scripts/push-auth-config.mjs <preview|production>`.
- Types: `supabase gen types typescript --linked > lib/supabase/database.types.ts`.
- Tests: `supabase test db` (pgTAP, needs the local stack) and `pnpm test:api`.
- Backups: Supabase Free keeps no point-in-time recovery. Before a risky migration take a dump:
  `supabase db dump --linked -f backup.sql` (schema) and `--data-only -f data.sql`.

## Scheduled jobs

| Job                | Where          | Schedule        | What                                                             |
| ------------------ | -------------- | --------------- | ---------------------------------------------------------------- |
| `/api/cron/expire` | Vercel Cron    | daily 03:00 UTC | Expires idle rooms (`expire_rooms`), needs `CRON_SECRET`         |
| `keepalive.yml`    | GitHub Actions | every 3 days    | Hits `/api/health` on both sites so Supabase Free does not pause |
| `nightly.yml`      | GitHub Actions | daily 02:30 UTC | Full E2E, cross-browser and a11y suites against staging          |

## Monitoring

- Health: `GET /api/health` returns `{ ok: true }` after one database query; `GET /api/version` returns the deployed commit.
- Errors: Sentry (when the DSN is set). Product events: PostHog (when the key is set).
- Vercel dashboard: function logs, Speed Insights, Web Analytics.
- Supabase dashboard: database size, auth users, realtime connections, logs.

## Free-tier limits to watch

| Service          | Limit                                                                                                                | What happens at the limit                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Vercel Hobby     | 100 GB bandwidth, 1M function invocations per month, daily cron only                                                 | Deploys pause until next month; non-commercial use only        |
| Supabase Free    | 500 MB database, 50k monthly active users, 200 concurrent realtime connections, 2 projects, pauses after 7 days idle | Writes fail when full; rooms stop syncing past 200 connections |
| Supabase Auth    | Default email sender: about 2 emails per hour                                                                        | Admin password reset emails get delayed                        |
| GitHub Actions   | 2,000 minutes per month on private repos                                                                             | CI stops until next month                                      |
| Sentry Developer | 5k errors per month                                                                                                  | Further events dropped                                         |
| PostHog Free     | 1M events per month                                                                                                  | Further events dropped                                         |
| Turnstile        | Free, unlimited                                                                                                      |                                                                |

At 200 concurrent realtime connections a room of 12 uses 12, so about 16 full rooms at once.

## Incidents

- Site down: check Vercel status and the latest deployment; roll back in Vercel (Deployments, promote
  the previous one). A rollback does not undo migrations.
- Database paused: open the Supabase dashboard and restore the project; then check `keepalive.yml` ran.
- Abuse or spam rooms: admin console, Settings, tighten the room and join rate limits; Flags, turn off
  `adult_packs_enabled` or `test_players` if they are the problem. Flags apply within 15 seconds.
- Realtime outage or the 200-connection cap: turn on the `polling_only` flag; rooms fall back to polling.
- Leaked key: rotate it (above). For the service-role key, also check Supabase logs for misuse.
- Kill switch for a pack: admin console, Packs, set it to draft.

## Admin accounts

- The first owner is created once per environment with `INITIAL_OWNER_EMAIL` and the setup script;
  they set a password through the reset link.
- Owners invite admins and editors from the console. Roles: owner, admin, editor.
- Public sign-up is off; anonymous sign-in is on (players).
