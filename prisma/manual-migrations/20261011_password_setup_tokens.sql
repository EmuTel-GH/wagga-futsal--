-- 2026-10-11 — one-time password setup links (replaces username-only first sign-in).
-- Generated with `prisma migrate diff --from-schema <develop's schema> --to-schema prisma/schema.prisma --script`.
-- Additive (new table): the previous release runs unchanged against it.

-- CreateTable
CREATE TABLE "PasswordSetupToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordSetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordSetupToken_tokenHash_key" ON "PasswordSetupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordSetupToken_userId_idx" ON "PasswordSetupToken"("userId");

-- AddForeignKey
ALTER TABLE "PasswordSetupToken" ADD CONSTRAINT "PasswordSetupToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

