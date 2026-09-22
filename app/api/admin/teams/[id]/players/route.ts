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
  const { playerId, jerseyNumber, additionalFeePaid } = await req.json();

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  // Age eligibility (rules 7.2/7.4/7.5) against every competition this team is in.
  const [player, competitionTeams, existingMemberships] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, include: { dispensations: true } }),
    prisma.competitionTeam.findMany({ where: { teamId }, include: { competition: true } }),
    prisma.teamPlayer.findMany({
      where: { playerId },
      include: { team: { include: { competitions: { include: { competition: { select: { id: true, name: true } } } } } } },
    }),
  ]);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Rule 22.1 — a player cannot be in two teams in the same competition.
  const thisTeamCompIds = new Set(competitionTeams.map((ct) => ct.competitionId));
  for (const m of existingMemberships) {
    const clash = m.team.competitions.find((tc) => thisTeamCompIds.has(tc.competition.id));
    if (clash) {
      return NextResponse.json(
        { error: `${player.firstName} ${player.lastName} already plays for ${m.team.name} in ${clash.competition.name} — a player cannot be in two teams in the same competition (rule 22.1).` },
        { status: 409 }
      );
    }
  }

  // First team = primary (covered by registration). Any further team is an
  // additional team and attracts the $135 additional-team fee.
  const isPrimary = existingMemberships.length === 0;

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
      isPrimary,
      additionalFeePaid: isPrimary ? false : Boolean(additionalFeePaid),
    },
    include: { player: true },
  });

  return NextResponse.json(teamPlayer, { status: 201 });
}

// PATCH — update a squad member (e.g. mark the $135 additional-team fee paid).
export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { playerId, additionalFeePaid, jerseyNumber } = await req.json();
  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof additionalFeePaid === "boolean") data.additionalFeePaid = additionalFeePaid;
  if (jerseyNumber !== undefined) data.jerseyNumber = jerseyNumber ? Number(jerseyNumber) : null;

  const teamPlayer = await prisma.teamPlayer.update({
    where: { teamId_playerId: { teamId, playerId } },
    data,
    include: { player: true },
  });

  return NextResponse.json(teamPlayer);
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
