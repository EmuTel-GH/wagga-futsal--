// Runs only with TEST_DATABASE_URL (a Postgres the test may create databases on); CI provides one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { migrate } from "../scripts/migrate.mjs";

const admin = process.env.TEST_DATABASE_URL;
const skip = !admin && "set TEST_DATABASE_URL to run";

async function freshDb(name: string) {
  const c = new pg.Client({ connectionString: admin });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS ${name}`);
  await c.query(`CREATE DATABASE ${name}`);
  await c.end();
  const u = new URL(admin!);
  u.pathname = `/${name}`;
  return u.toString();
}
async function q(url: string, sql: string) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try { return (await c.query(sql)).rows; } finally { await c.end(); }
}
function dir(files: Record<string, string>, baseline: string[] = []) {
  const d = mkdtempSync(join(tmpdir(), "mig-"));
  for (const [f, s] of Object.entries(files)) writeFileSync(join(d, f), s);
  writeFileSync(join(d, "_baseline.txt"), "# comment\n" + baseline.join("\n") + "\n");
  return d;
}

test("empty database is refused (no accidental partial schema)", { skip }, async () => {
  const url = await freshDb("mig_empty");
  await assert.rejects(migrate({ connectionString: url, dir: dir({ "001.sql": "CREATE TABLE a(x int);" }), all: false }), /Empty database/);
});

test("existing database: baseline recorded, not run; newer files applied once", { skip }, async () => {
  const url = await freshDb("mig_existing");
  await q(url, `CREATE TABLE "User"(id text)`);
  const d = dir({ "001_old.sql": "THIS WOULD FAIL IF RUN;", "002_new.sql": "CREATE TABLE added(x int DEFAULT 1);" }, ["001_old.sql"]);
  assert.deepEqual((await migrate({ connectionString: url, dir: d, all: false })).applied, ["002_new.sql"]);
  const rows = await q(url, `SELECT filename, baselined FROM "_app_migrations" ORDER BY filename`);
  assert.deepEqual(rows, [{ filename: "001_old.sql", baselined: true }, { filename: "002_new.sql", baselined: false }]);
  assert.deepEqual((await migrate({ connectionString: url, dir: d, all: false })).applied, [], "second run is a no-op");
});

test("a failing migration is rolled back, not recorded, and fails the run", { skip }, async () => {
  const url = await freshDb("mig_fail");
  await q(url, `CREATE TABLE "User"(id text)`);
  const d = dir({ "001.sql": "CREATE TABLE half(x int); SELECT nope_not_a_function();" });
  await assert.rejects(migrate({ connectionString: url, dir: d, all: false }), /001\.sql failed and was rolled back/);
  assert.equal((await q(url, "SELECT to_regclass('public.half') AS t"))[0].t, null, "partial changes rolled back");
  assert.equal((await q(url, `SELECT count(*)::int n FROM "_app_migrations"`))[0].n, 0);
});

test("editing an applied migration is caught", { skip }, async () => {
  const url = await freshDb("mig_edit");
  await q(url, `CREATE TABLE "User"(id text)`);
  const d = dir({ "001.sql": "CREATE TABLE t1(x int);" });
  await migrate({ connectionString: url, dir: d, all: false });
  appendFileSync(join(d, "001.sql"), "\n-- sneaky edit\n");
  await assert.rejects(migrate({ connectionString: url, dir: d, all: false }), /changed after it was applied/);
});

test("--baseline-all bootstraps a freshly db-pushed database", { skip }, async () => {
  const url = await freshDb("mig_bootstrap");
  const d = dir({ "001.sql": "WOULD FAIL;", "002.sql": "WOULD FAIL TOO;" });
  assert.deepEqual((await migrate({ connectionString: url, dir: d, all: true })).applied, []);
  assert.equal((await q(url, `SELECT count(*)::int n FROM "_app_migrations" WHERE baselined`))[0].n, 2);
});
