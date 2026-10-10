-- 2026-10-10 — planned grand final date/pitch on competitions.
--
-- Applied as reviewed SQL, not `prisma db push`. Generated with `prisma migrate
-- diff --from-config-datasource --to-schema prisma/schema.prisma --script`
-- against a restored copy of production. Additive (two nullable columns).
--
-- Applied by hand before scripts/migrate.mjs existed (see _baseline.txt).

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "finalsGrandFinalAt" TIMESTAMP(3),
ADD COLUMN     "finalsGrandFinalPitchId" TEXT;

