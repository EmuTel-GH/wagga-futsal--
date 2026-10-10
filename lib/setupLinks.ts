import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { hashSetupToken, looksLikeSetupToken, newSetupToken, setupLinkExpiry } from "./setupTokens";

/**
 * One-time password setup links. An admin creates one (new account, or a
 * reset) and hands it over directly, since the app doesn't send email yet.
 * - Only the SHA-256 of the token is stored.
 * - Single use, 7-day expiry, and making a new link deletes any older ones.
 * - Setting the password through it signs out any other sessions.
 */
export async function createSetupLink(userId: string, createdById: string | null) {
  const token = newSetupToken();
  const expiresAt = setupLinkExpiry();
  await prisma.$transaction([
    prisma.passwordSetupToken.deleteMany({ where: { userId } }),
    prisma.passwordSetupToken.create({ data: { userId, tokenHash: hashSetupToken(token), expiresAt, createdById } }),
  ]);
  return { token, expiresAt };
}

export type ConsumeResult =
  | { ok: true; user: { id: string; email: string; name: string; role: string } }
  | { ok: false; error: string };

const INVALID = "This set-up link is invalid, expired or already used. Ask an administrator for a new one.";

/** Use a link to set the password. Atomic: a link can only succeed once. */
export async function consumeSetupLink(token: unknown, password: string): Promise<ConsumeResult> {
  if (!looksLikeSetupToken(token)) return { ok: false, error: INVALID };
  const tokenHash = hashSetupToken(token);
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    // Claim it: only one request can flip usedAt from null.
    const claimed = await tx.passwordSetupToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() }, user: { active: true } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return { ok: false, error: INVALID } as const;
    const row = await tx.passwordSetupToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });
    await tx.user.update({ where: { id: row!.userId }, data: { passwordHash, mustSetPassword: false } });
    await tx.passwordSetupToken.deleteMany({ where: { userId: row!.userId, id: { not: row!.id } } });
    await tx.authSession.deleteMany({ where: { userId: row!.userId } });
    return { ok: true, user: row!.user } as const;
  });
}
