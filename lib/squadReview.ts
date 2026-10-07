import { prisma } from "./prisma";
import { reviewExpected, type ExpectedReview } from "./eligibility";

/**
 * Review the expected squads (team registration form names) of the given teams
 * — or every team — against registrations and eligibility. Returns, per team,
 * the names an administrator still has to authorise or reject.
 */
export async function flaggedExpected(teamIds?: string[]) {
  const [teams, players, dispensations] = await Promise.all([
    prisma.team.findMany({
      where: teamIds ? { id: { in: teamIds } } : undefined,
      select: {
        id: true,
        name: true,
        status: true,
        expected: true,
        players: { select: { playerId: true } },
        competitions: { select: { competition: { select: { id: true, name: true, ageGroup: true, gender: true } } } },
      },
    }),
    prisma.player.findMany({
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, registeredAgeGroup: true },
    }),
    prisma.dispensation.findMany({ select: { playerId: true, competitionId: true, type: true } }),
  ]);

  return teams.map((team) => {
    const competition = team.competitions[0]?.competition ?? null;
    const rosterPlayerIds = team.players.map((p) => p.playerId);
    const flagged = team.expected
      .map((expected) => ({
        expected,
        review: reviewExpected({ expected, players, rosterPlayerIds, competition, dispensations }),
      }))
      .filter((r): r is { expected: typeof r.expected; review: Extract<ExpectedReview, { state: "INELIGIBLE" }> } =>
        r.review.state === "INELIGIBLE"
      );
    return { teamId: team.id, teamName: team.name, status: team.status, flagged };
  });
}
