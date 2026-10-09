import type { Fixture } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Finals: "Start finals" creates the two semi-finals (1 v 4, 2 v 3) and saves
 * the planned grand final date/pitch on the competition. The grand final is
 * created as soon as both semis have a winner, whether that's the same night
 * (juniors) or a week later (seniors). A drawn semi (decided on penalties,
 * which aren't recorded) needs an admin to pick the winner instead.
 */

/** Winner of a played semi, or null if not decided (unplayed or drawn). */
export function semiWinner(f: Pick<Fixture, "status" | "homeTeamId" | "awayTeamId" | "homeScore" | "awayScore">) {
  if (f.status === "FORFEITED_HOME") return f.awayTeamId;
  if (f.status === "FORFEITED_AWAY") return f.homeTeamId;
  if (f.status !== "COMPLETED" || f.homeScore === f.awayScore) return null;
  return f.homeScore > f.awayScore ? f.homeTeamId : f.awayTeamId;
}

export async function finalsState(competitionId: string) {
  const [competition, semis, grandFinal] = await Promise.all([
    prisma.competition.findUnique({ where: { id: competitionId } }),
    prisma.fixture.findMany({ where: { competitionId, phase: "SEMI_FINAL" }, orderBy: { scheduledAt: "asc" } }),
    prisma.fixture.findFirst({ where: { competitionId, phase: "GRAND_FINAL" } }),
  ]);
  const winners = semis.map(semiWinner);
  return { competition, semis, grandFinal, winners };
}

/**
 * Create the grand final if it's due: both semis decided, none created yet,
 * and a planned date/pitch saved. Returns the new fixture, or null.
 */
export async function maybeCreateGrandFinal(competitionId: string) {
  const { competition, semis, grandFinal, winners } = await finalsState(competitionId);
  if (!competition || grandFinal || semis.length !== 2 || winners.some((w) => !w)) return null;
  if (!competition.finalsGrandFinalAt || !competition.finalsGrandFinalPitchId) return null;
  return prisma.fixture.create({
    data: {
      competitionId,
      homeTeamId: winners[0]!,
      awayTeamId: winners[1]!,
      pitchId: competition.finalsGrandFinalPitchId,
      scheduledAt: competition.finalsGrandFinalAt,
      round: 2,
      phase: "GRAND_FINAL",
      // The semis have been played, so they're public: publish the GF too.
      status: "SCHEDULED",
    },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });
}
