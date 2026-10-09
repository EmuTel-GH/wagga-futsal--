-- 2026-10-10 — planned grand final date/pitch on competitions.
--
-- Applied as reviewed SQL, not `prisma db push`. Generated with `prisma migrate
-- diff --from-config-datasource --to-schema prisma/schema.prisma --script`
-- against a restored copy of production. Additive (two nullable columns).
--
-- Apply (after a pg_dump):
--   docker exec -i wagga-futsal-db psql -U futsal -d futsal -v ON_ERROR_STOP=1 < this-file.sql

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "finalsGrandFinalAt" TIMESTAMP(3),
ADD COLUMN     "finalsGrandFinalPitchId" TEXT;

