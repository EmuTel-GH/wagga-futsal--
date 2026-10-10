-- 2026-10-07 — draft fixtures (FixtureStatus DRAFT) and breaks & holidays (FixtureBreak).
--
-- Applied as reviewed SQL, not `prisma db push` (see 20261007_users_audit_overrides.sql).
-- Generated with `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma --script` against a restored copy of production.
-- Purely additive: the previous app version runs unchanged against it.
--
-- Applied by hand before scripts/migrate.mjs existed (see _baseline.txt).

-- AlterEnum
ALTER TYPE "FixtureStatus" ADD VALUE 'DRAFT';

-- CreateTable
CREATE TABLE "FixtureBreak" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "competitionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixtureBreak_startDate_idx" ON "FixtureBreak"("startDate");

-- AddForeignKey
ALTER TABLE "FixtureBreak" ADD CONSTRAINT "FixtureBreak_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

