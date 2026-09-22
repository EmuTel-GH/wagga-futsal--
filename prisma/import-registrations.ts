/**
 * CLI runner for the PlayFootball registration import.
 * Usage: DATABASE_URL=... npx tsx prisma/import-registrations.ts <path-to-csv>
 */
import { readFileSync } from "fs";
import { importRegistrations } from "../lib/importRegistrations";
import { prisma } from "../lib/prisma";

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx prisma/import-registrations.ts <csv>");
    process.exit(1);
  }
  const summary = await importRegistrations(readFileSync(path, "utf8"));
  console.log(`Players:   ${summary.players}`);
  console.log(`Officials: ${summary.officials}`);
  console.log(`Referees:  ${summary.referees}`);
  console.log(`Skipped:   ${summary.skipped}`);
  for (const e of summary.errors) console.log("  !", e);
}

main().finally(() => prisma.$disconnect());
