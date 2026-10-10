-- 2026-10-09 — draw settings (times each / max rounds / end date) and
-- competition splits (splitFromId).
--
-- Applied as reviewed SQL, not `prisma db push` (see 20261007_users_audit_overrides.sql).
-- Generated with `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma --script` against a restored copy of production.
-- Purely additive (nullable columns + FK): the previous app version runs unchanged.
--
-- Applied by hand before scripts/migrate.mjs existed (see _baseline.txt).

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "drawMaxRounds" INTEGER,
ADD COLUMN     "drawTimesEach" INTEGER,
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "splitFromId" TEXT;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_splitFromId_fkey" FOREIGN KEY ("splitFromId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

