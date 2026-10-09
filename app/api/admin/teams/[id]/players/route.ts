import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { addPlayerToTeam } from "@/lib/teamPlayers";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { playerId, jerseyNumber, additionalFeePaid, override } = await req.json();

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  // Administrators with OVERRIDE_RULES may proceed past a rule block by
  // re-sending the request with { override: { reason } }.
  const canOverride = hasPermission(session.user, "OVERRIDE_RULES");
  const overrideReason = typeof override?.reason === "string" ? override.reason.trim() : "";
  if (override && !canOverride) {
    return NextResponse.json({ error: "You don't have permission to override eligibility rules." }, { status: 403 });
  }
  if (override && overrideReason.length < 3) {
    return NextResponse.json({ error: "Give a reason for the override." }, { status: 400 });
  }

  const result = await addPlayerToTeam(session, {
    teamId,
    playerId,
    jerseyNumber,
    additionalFeePaid,
    overrideReason: override ? overrideReason : undefined,
  });
  if (!result.ok) {
    const { error, requiresDispensation, competitionId } = result;
    return NextResponse.json(
      result.status === 409 ? { error, requiresDispensation, competitionId, overridable: canOverride } : { error },
      { status: result.status }
    );
  }

  return NextResponse.json({ ...result.teamPlayer, dispensations: result.dispensations }, { status: 201 });
}

// PATCH — update a squad member (e.g. mark the $135 additional-team fee paid).
export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
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
  if (jerseyNumber !== undefined) {
    const n = jerseyNumber === null || jerseyNumber === "" ? null : Number(jerseyNumber);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 999)) {
      return NextResponse.json({ error: "Shirt number must be 0–999" }, { status: 400 });
    }
    // Shirt numbers are unique within a team.
    const taken = n === null ? null : await prisma.teamPlayer.findFirst({
      where: { teamId, jerseyNumber: n, playerId: { not: playerId } },
      include: { player: { select: { firstName: true, lastName: true } } },
    });
    if (taken) {
      return NextResponse.json({ error: `#${n} is ${taken.player.firstName} ${taken.player.lastName}'s` }, { status: 409 });
    }
    data.jerseyNumber = n;
  }

  const teamPlayer = await prisma.teamPlayer.update({
    where: { teamId_playerId: { teamId, playerId } },
    data,
    include: { player: true, team: { select: { name: true } } },
  });

  await audit(session, {
    action: "team.player.update",
    summary: `Updated ${teamPlayer.player.firstName} ${teamPlayer.player.lastName} in ${teamPlayer.team.name} (${Object.keys(data).join(", ")})`,
    entityType: "Team",
    entityId: teamId,
    details: { playerId, ...data },
  });

  return NextResponse.json(teamPlayer);
}

export async function DELETE(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");

  if (!playerId) {
    return NextResponse.json({ error: "playerId query param required" }, { status: 400 });
  }

  const [player, team] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { firstName: true, lastName: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
  ]);
  await prisma.teamPlayer.deleteMany({ where: { teamId, playerId } });
  await audit(session, {
    action: "team.player.remove",
    summary: `Removed ${player ? `${player.firstName} ${player.lastName}` : "player"} from ${team?.name ?? "team"}`,
    entityType: "Team",
    entityId: teamId,
    details: { playerId },
  });

  return NextResponse.json({ ok: true });
}
