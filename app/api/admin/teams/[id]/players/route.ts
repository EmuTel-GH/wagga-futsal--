import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { checkEligibility } from "@/lib/eligibility";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { playerId, jerseyNumber } = await req.json();

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  // Age eligibility (rules 7.2/7.4/7.5) against every competition this team is in.
  const [player, competitionTeams] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, include: { dispensations: true } }),
    prisma.competitionTeam.findMany({ where: { teamId }, include: { competition: true } }),
  ]);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  for (const ct of competitionTeams) {
    const dispensation = player.dispensations.find((d) => d.competitionId === ct.competitionId) ?? null;
    const result = checkEligibility({
      dateOfBirth: player.dateOfBirth,
      gender: player.gender,
      registeredAgeGroup: player.registeredAgeGroup,
      competition: ct.competition,
      dispensation,
    });
    if (!result.eligible) {
      return NextResponse.json(
        {
          error: `${player.firstName} ${player.lastName} is not eligible for ${ct.competition.name}: ${result.reason}`,
          requiresDispensation: result.requires,
          competitionId: ct.competitionId,
        },
        { status: 409 }
      );
    }
  }

  const teamPlayer = await prisma.teamPlayer.create({
    data: {
      teamId,
      playerId,
      jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
    },
    include: { player: true },
  });

  return NextResponse.json(teamPlayer, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");

  if (!playerId) {
    return NextResponse.json({ error: "playerId query param required" }, { status: 400 });
  }

  await prisma.teamPlayer.deleteMany({ where: { teamId, playerId } });

  return NextResponse.json({ ok: true });
}
