@AGENTS.md

# Wagga Futsal (EmuSport): working on this repo

Competition management for one club, Wagga Futsal: competitions, draws and
fixtures, teams and registrations, live scoring by referees, referee payroll
(ABA file), public draw/ladder/team pages with calendar feeds.
Next.js 16 (App Router) + Prisma 7 + Postgres 18, built as a Docker image.

Several people and Claude sessions work on this at once (Brad, and Andy from
his iPad). Everything shared lives in this repo, so read it, and keep it current.

## Before you start
- **Check open PRs and branches** (`gh pr list`) so two sessions don't build
  the same thing or edit the same files. Pull `develop` first.
- **Small PRs**, one change each. Branch from `develop`.

## How code reaches the sites — never deploy by hand
| Merge into | Site | |
|---|---|---|
| `develop` | **staging**, https://staging.waggafutsal.emutel.com.au (password-protected) | try things here |
| `main` | **production**, https://waggafutsal.com.au | live |

1. Feature branch → PR into `develop` → the **`ci`** check must pass → merge.
   CI publishes the image and the staging server picks it up within minutes.
2. Check it on staging (footer shows the version), then PR `develop` → `main`.
3. Hotfix: branch from `main`, PR into `main`, then merge `main` back into `develop`.

**Never** build images on a server, change what version a server runs, or copy
code onto it: merging is the only way to deploy. Rollback = the `rollback`
workflow (see docs/RELEASING.md). There are no required reviewers: once `ci`
is green and you've tested it, merge (and promote) without waiting.

## Every PR
- Adds a line to **CHANGELOG.md** (plain English, something that could be
  forwarded to the club).
- Passes `npm run typecheck`, `npm run lint`, `npm test` (CI runs all three,
  plus a Docker build, the migration runner inside the image and `/api/health`).
- Adds tests in `tests/` for logic changes (`node --test` via tsx; database
  tests run when `TEST_DATABASE_URL` is set, which CI does).

## Database changes (migrations)
- Schema lives in `prisma/schema.prisma`, but **never `prisma db push` or
  `prisma migrate` against staging/production**.
- For a schema change: edit `schema.prisma`, then add a new SQL file
  `prisma/manual-migrations/YYYYMMDD[x]_what.sql`, generated with
  `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
  against a database at the current schema, and reviewed by eye.
- On deploy, `scripts/migrate.mjs` applies new files in order, each in a
  transaction, and records them in `_app_migrations`. A failure aborts the deploy.
  - Don't put `BEGIN`/`COMMIT` in the files.
  - **Never edit a file once merged.** Add a new one.
  - `_baseline.txt` lists the files that were applied by hand before automation;
    never add to it.
- **Migrations must also work with the previous release** (an automatic
  rollback runs the old code on the new schema): add columns as nullable or with
  a default, add tables freely, and only drop or rename in a later release once
  no deployed code uses the old shape.
  - **New enum values: add them in one release, store them in a later one.**
    An older Prisma client throws on any enum value it doesn't know, so a row
    holding a new value breaks the previous release. Add the value (in its own
    file: `ALTER TYPE … ADD VALUE` can't be used in the same transaction); only
    after that release is live in production may a migration or the app write
    it. CI's payroll step shows the failure.
- Fresh empty database (new environment): `prisma db push`, then
  `node scripts/migrate.mjs --baseline-all`.

## Build and runtime gotchas (already solved: don't regress)
- `npm ci` needs `package-lock.json` in sync with `package.json`.
- `NEXT_PUBLIC_*` is inlined at **build** time; `APP_URL`, `APP_ENV`,
  `APP_VERSION` and secrets are read at **runtime**. Read runtime values in
  server code via `lib/runtimeInfo.ts` (uses `connection()`), or they get
  frozen into prerendered pages.
- The build needs placeholder `DATABASE_URL` and `STRIPE_SECRET_KEY` (set in
  the Dockerfile): Next evaluates server modules while building and the Stripe
  client is created at module scope.
- Prisma 7: `--skip-generate` no longer exists (passing it prints help and
  exits 0). `prisma.config.ts` needs `dotenv` from the project's node_modules.
- Debian slim, not Alpine (Prisma vs musl/openssl). `pg_dump` must be ≥ 18.
- Times: fixtures are stored in UTC; the club is in Australia/Sydney (DST).
  Do date maths per Sydney calendar day (`lib/breakDates.ts`), and convert
  `datetime-local` inputs in the browser (see `FixtureRow.tsx`).
- `proxy.ts` gates the **staging** site (APP_ENV=staging): only an active
  ADMIN's real session gets past, apart from sign-in, `/api/auth/*`,
  `/api/health` and static files; every response gets `X-Robots-Tag: noindex`.
  In production it does nothing. Logic + tests: `lib/stagingGate.ts`.
  **This is the only lock on staging** (it holds a copy of real data, and
  there's no password prompt in front of it any more). Keep it working in
  every version. Never remove, bypass or loosen it, or widen its open paths
  without a very good reason. CI's "Staging gate" step fails if it stops working.
- Referees' bank details are encrypted in the app (`lib/bankDetails.ts`) and
  only ever sent to the browser masked. Keep it that way.
- Next.js here differs from older versions: read `node_modules/next/dist/docs/`.

## Never
- Print, log or commit secrets, passwords, `.env` contents or customer
  personal data (CSV exports, bank details, dates of birth).
- Put server details in this repo (it's public): no internal IPs, hostnames of
  internal machines, server paths or credentials.
- Weaken an auth or permission check to make something work.

## Useful places
- `lib/setupLinks.ts`: one-time password set-up links (hashed, single use, 7 days).
  Never reintroduce username-only first sign-in.
- `lib/draw.ts` (round-robin + scheduling around breaks), `lib/drawRequests.ts`
  (fix a match/bye to a week), `lib/split.ts`, `lib/finals.ts`,
  `lib/eligibility.ts` (age rules), `lib/audit.ts` (audit log: call it from
  every mutating route), `lib/teamSchedule.ts` + `lib/ics.ts` (calendar feeds).
- `docs/RELEASING.md`: promoting, rolling back, finding out what's live.
