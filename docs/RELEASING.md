# Releasing Wagga Futsal

## What's live?
The footer of every page (and the admin sidebar) shows **Version `abc1234`**,
the short git commit. `/api/health` returns `{ "ok": true, "version": "abc1234" }`.
The staging site also shows a yellow **STAGING** banner.

| Branch | Site | Image tag |
|---|---|---|
| `develop` | staging: https://staging.waggafutsal.emutel.com.au | `ghcr.io/emutel-gh/wagga-futsal:develop` |
| `main` | production: https://waggafutsal.com.au | `ghcr.io/emutel-gh/wagga-futsal:main` |

Every published build is also tagged with its short sha.

## Ship a change
1. Branch from `develop`, make the change, add a CHANGELOG line.
2. Open a PR into `develop`. Wait for **ci** to go green, then merge.
3. The `release` workflow publishes `:develop`; staging updates itself within a
   few minutes (database backed up and migrations applied first). Check the
   footer version, then check the change on staging.
4. Open a PR **`develop` → `main`** (title: what's in it), wait for **ci**, merge.
   Production updates the same way. Check the footer on waggafutsal.com.au.

If a new version fails its health check after deploying, the server switches
back to the previous version on its own and won't retry it until the branch
moves again. Look at the PR, fix forward, merge again.

## Hotfix
Branch from `main` → PR into `main` → merge → then PR `main` → `develop` so
develop doesn't lose the fix.

## Roll back
1. Find the last good version (the footer, the CHANGELOG, or the `release`
   workflow runs).
2. Actions → **rollback** → Run workflow: `version` = that short sha,
   `channel` = `main` (production) or `develop` (staging).
3. The site switches within a few minutes; check the footer.
4. Open a revert PR. The next merge to that branch moves the site forward
   again, so the bad change must be reverted (or fixed) in git too.

Only versions that CI published can be rolled back to.

Database migrations aren't undone by a rollback. That's why every migration
must work with the previous release too (see CLAUDE.md).
