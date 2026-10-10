-- 2026-10-07 — users & permissions, audit log, eligibility overrides, nomination rejections.
--
-- This database is managed without `prisma migrate` history, and `prisma db push`
-- can silently drop things the repo doesn't know about. So schema changes are
-- applied as reviewed SQL. Generated with:
--   prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- against a restored copy of production. Purely additive: nothing is dropped
-- or rewritten, and the previous app version runs unchanged against it.
--
-- Applied by hand before scripts/migrate.mjs existed (see _baseline.txt).

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('MANAGE_USERS', 'OVERRIDE_RULES', 'VIEW_AUDIT');

-- AlterEnum
ALTER TYPE "DispensationType" ADD VALUE 'OVERRIDE';

-- AlterTable
ALTER TABLE "ExpectedPlayer" ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "permissions" "Permission"[] DEFAULT ARRAY[]::"Permission"[];

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "actorEmail" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

