import { prisma } from "./prisma";

export * from "./breakDates";

/** Breaks that apply to a competition: its own plus the all-competition ones. */
export function breaksForCompetition(competitionId: string) {
  return prisma.fixtureBreak.findMany({
    where: { OR: [{ competitionId: null }, { competitionId }] },
    orderBy: { startDate: "asc" },
  });
}
