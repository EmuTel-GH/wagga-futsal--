#!/usr/bin/env node
/**
 * Apply prisma/manual-migrations/*.sql to DATABASE_URL, in filename order.
 *
 * Run automatically by the deployer before a new version goes live (in a
 * one-off container of the new image); a non-zero exit aborts that deploy.
 * Also fine to run by hand: `node scripts/migrate.mjs`.
 *
 * - Each file runs in its own transaction and is recorded in
 *   _app_migrations(filename, checksum, applied_at). Recorded files are skipped.
 * - If a recorded file's contents change, it fails loudly: write a NEW file instead.
 * - First run on a database that predates this script: the files listed in
 *   _baseline.txt (applied by hand before automation) are recorded without
 *   running. Anything newer then runs normally.
 * - Brand-new empty database: refuses. Create the schema with `prisma db push`,
 *   then run with --baseline-all to record every current file as applied.
 * - A Postgres advisory lock stops two runs overlapping.
 *
 * Migrations must keep working with the PREVIOUS release (an automatic
 * rollback runs old code on the new schema): add columns nullable or with a
 * default, add tables freely; drop/rename only in a later release.
 * Don't put BEGIN/COMMIT in the files — each is wrapped in a transaction.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.MIGRATIONS_DIR ?? join(here, "..", "prisma", "manual-migrations");
const BASELINE = join(DIR, "_baseline.txt");
const LOCK_ID = 7342019; // arbitrary, constant: "wagga-futsal migrations"
const baselineAll = process.argv.includes("--baseline-all");

const log = (msg) => console.log(`[migrate] ${msg}`);
const checksum = (text) => createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");

export async function migrate({ connectionString = process.env.DATABASE_URL, dir = DIR, all = baselineAll } = {}) {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const sql = new Map(files.map((f) => [f, readFileSync(join(dir, f), "utf8")]));
  const client = new pg.Client({ connectionString });
  await client.connect();
  const applied = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    const exists = (await client.query("SELECT to_regclass('public._app_migrations') AS t")).rows[0].t;
    if (!exists) {
      const hasSchema = (await client.query(`SELECT to_regclass('public."User"') AS t`)).rows[0].t;
      if (!hasSchema && !all) {
        throw new Error('Empty database: create the schema with `prisma db push`, then run `node scripts/migrate.mjs --baseline-all`.');
      }
      const listPath = join(dir, "_baseline.txt");
      const baseline = all
        ? files
        : existsSync(listPath)
          ? readFileSync(listPath, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
          : [];
      const missing = baseline.filter((f) => !sql.has(f));
      if (missing.length) throw new Error(`Baseline lists files that don't exist: ${missing.join(", ")}`);
      await client.query("BEGIN");
      await client.query(`CREATE TABLE "_app_migrations" (
        "filename" TEXT PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "baselined" BOOLEAN NOT NULL DEFAULT false)`);
      for (const f of baseline) {
        await client.query(`INSERT INTO "_app_migrations"(filename, checksum, baselined) VALUES ($1, $2, true)`, [f, checksum(sql.get(f))]);
      }
      await client.query("COMMIT");
      log(`baseline: recorded ${baseline.length} file(s) as already applied${all ? " (--baseline-all)" : ""}`);
    }

    const recorded = new Map((await client.query(`SELECT filename, checksum FROM "_app_migrations"`)).rows.map((r) => [r.filename, r.checksum]));
    for (const [f, sum] of recorded) {
      if (sql.has(f) && checksum(sql.get(f)) !== sum) {
        throw new Error(`${f} was changed after it was applied. Never edit an applied migration; add a new file.`);
      }
    }
    for (const f of files) {
      if (recorded.has(f)) continue;
      log(`applying ${f}`);
      try {
        await client.query("BEGIN");
        await client.query(sql.get(f));
        await client.query(`INSERT INTO "_app_migrations"(filename, checksum) VALUES ($1, $2)`, [f, checksum(sql.get(f))]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw new Error(`${f} failed and was rolled back: ${err.message}`);
      }
      applied.push(f);
    }
    log(applied.length ? `applied ${applied.length}: ${applied.join(", ")}` : "up to date");
    return { applied };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    await client.end();
  }
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate().then(
    () => process.exit(0),
    (err) => {
      console.error(`[migrate] FAILED: ${err.message}`);
      process.exit(1);
    }
  );
}
