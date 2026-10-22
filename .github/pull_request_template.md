## What

<!-- One or two sentences. Link the requirement IDs (FR-*, NFR-*) this covers. -->

## Why

## QA checklist

- [ ] `pnpm typecheck && pnpm lint && pnpm format:check` clean
- [ ] `pnpm test` green (coverage on `lib/game` stays 90%+)
- [ ] `pnpm e2e:smoke` green
- [ ] Checked in a real browser: mobile 390 and desktop 1280
- [ ] Checked in both themes (dark and light)
- [ ] Keyboard only path works; focus ring visible
- [ ] Reduced motion checked
- [ ] Visual parity: `pnpm test:visual` green, or diff explained in `docs/DECISIONS.md`
- [ ] New copy is in `messages/en.json`, no em or en dashes
- [ ] No hex colours outside `app/styles`
- [ ] Migrations have pgTAP tests; every new table has RLS

## Screenshots
