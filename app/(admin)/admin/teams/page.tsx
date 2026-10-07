import { prisma } from "@/lib/prisma";
import { requireAdmin, hasPermission } from "@/lib/auth";
import TeamsClient from "./TeamsClient";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const session = await requireAdmin();
  const [teams, allPlayers, allCompetitions, allOfficials, dispensations] = await Promise.all([
    prisma.team.findMany({
      include: {
        _count: { select: { players: true } },
        competitions: {
          include: { competition: { select: { id: true, name: true, season: true, ageGroup: true, gender: true } } },
        },
        players: {
          include: { player: true },
          orderBy: { jerseyNumber: "asc" },
        },
        officials: { orderBy: { lastName: "asc" } },
        expected: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    // DOB/gender/registered group feed the eligibility flags on expected squads.
    prisma.player.findMany({
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, registeredAgeGroup: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.competition.findMany({
      select: { id: true, name: true, season: true },
      where: { status: { not: "COMPLETED" } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teamOfficial.findMany({
      select: { id: true, firstName: true, lastName: true, role: true, teamId: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.dispensation.findMany({
      select: { id: true, playerId: true, competitionId: true, type: true, approvedBy: true, note: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-black text-navy mb-6">Teams</h1>
      <TeamsClient
        initialTeams={teams}
        allPlayers={allPlayers}
        allCompetitions={allCompetitions}
        allOfficials={allOfficials}
        initialDispensations={dispensations}
        canOverride={hasPermission(session.user, "OVERRIDE_RULES")}
      />
    </div>
  );
}
