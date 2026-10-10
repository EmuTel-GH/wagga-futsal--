import { prisma } from "./prisma";
import type { AuthSession } from "./auth";
import type { Caller } from "./fixtureAccess";

/** The signed-in user's role and (if they referee) their Referee id. */
export async function callerFor(session: AuthSession): Promise<Caller> {
  const ref = await prisma.referee.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  return { role: session.user.role, refereeId: ref?.id ?? null };
}
