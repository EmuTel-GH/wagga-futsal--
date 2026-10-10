-- 2026-10-10b — draw requests (fix a match to a week / choose a team's bye week).
--
-- Applied as reviewed SQL, not `prisma db push`. Generated with `prisma migrate
-- diff --from-config-datasource --to-schema prisma/schema.prisma --script`
-- against a restored copy of production. Additive (new enum + table).
--
-- Applied by hand before scripts/migrate.mjs existed (see _baseline.txt).

-- CreateEnum
CREATE TYPE "DrawRequestKind" AS ENUM ('MATCH_DATE', 'TEAM_BYE');

-- CreateTable
CREATE TABLE "DrawRequest" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "kind" "DrawRequestKind" NOT NULL,
    "date" DATE NOT NULL,
    "teamId" TEXT NOT NULL,
    "opponentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrawRequest_competitionId_idx" ON "DrawRequest"("competitionId");

-- AddForeignKey
ALTER TABLE "DrawRequest" ADD CONSTRAINT "DrawRequest_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawRequest" ADD CONSTRAINT "DrawRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawRequest" ADD CONSTRAINT "DrawRequest_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

