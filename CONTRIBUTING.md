# Contributing

## Authorship

Every commit is authored by `wisdomska(senya) <wisdomska@gmail.com>`. No other author, no `Co-authored-by` trailers, no AI attribution. The Husky `commit-msg` hook and the `authorship` CI job enforce this.

GitHub writes its own author on squash and merge commits, so the repo only allows **rebase merges**, and branches are squashed locally first.

## Flow

1. Branch from `preview`: `feat/*`, `fix/*`, `chore/*`, `test/*`, `docs/*`.
2. Commit with Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
3. Before opening the PR, squash the branch into one commit:
   ```bash
   git reset --soft $(git merge-base HEAD origin/preview)
   git commit -m "feat: short summary"
   git push --force-with-lease
   ```
4. Open a PR into `preview`. CI and the Vercel preview deploy must be green.
5. Merge with **Rebase and merge** (`gh pr merge --rebase`). The single commit lands with your authorship intact.
6. Delete the feature branch (`git push origin --delete <branch>`). The repo does not delete
   branches on merge, because that would also delete `preview` when a release PR merges.
7. Release: PR `preview` → `main`, landed by fast-forward, then tag `vX.Y.Z`. `preview` stays.

## Dependabot

Dependabot opens PRs but never merges them, because its commits are authored by the bot. To adopt one, apply its change on a `chore/*` branch as your own commit; Dependabot closes its PR automatically once the target branch has the new version.

## Checks before every commit

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm check:copy && pnpm test
```

Before every PR: `pnpm e2e:smoke`.
