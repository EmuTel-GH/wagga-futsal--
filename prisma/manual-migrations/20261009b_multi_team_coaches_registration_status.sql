-- 2026-10-09b — coaches/managers on several teams (TeamOfficialAssignment) and
-- PlayFootball registration/payment status on players.
--
-- Applied as reviewed SQL, not `prisma db push`. Schema part generated with
-- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
-- --script` against a restored copy of production; the data step at the end
-- copies existing single-team coach links into the new table. Additive: the
-- legacy TeamOfficial.teamId column is kept (no longer written) so the
-- previous app version still runs.
--
-- Apply AFTER 20261009_draw_options_split.sql (and a pg_dump):
--   docker exec -i wagga-futsal-db psql -U futsal -d futsal -v ON_ERROR_STOP=1 < this-file.sql

BEGIN;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "pfImportedAt" TIMESTAMP(3),
ADD COLUMN     "pfPaymentStatus" TEXT,
ADD COLUMN     "pfStatus" TEXT;

-- CreateTable
CREATE TABLE "TeamOfficialAssignment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "officialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamOfficialAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamOfficialAssignment_teamId_officialId_key" ON "TeamOfficialAssignment"("teamId", "officialId");

-- AddForeignKey
ALTER TABLE "TeamOfficialAssignment" ADD CONSTRAINT "TeamOfficialAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamOfficialAssignment" ADD CONSTRAINT "TeamOfficialAssignment_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "TeamOfficial"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data: existing coach/manager → team links become assignments.
INSERT INTO "TeamOfficialAssignment" ("id", "teamId", "officialId")
SELECT 'mig_' || replace(gen_random_uuid()::text, '-', ''), "teamId", "id"
FROM "TeamOfficial"
WHERE "teamId" IS NOT NULL
ON CONFLICT ("teamId", "officialId") DO NOTHING;

COMMIT;
