import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { approvalTypeFor, checkEligibility, type EligibilityResult } from "@/lib/eligibility";
import type { DispensationType } from "@prisma/client";

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
  const overriding = Boolean(override);

  // Age eligibility (rules 7.2/7.4/7.5) against every competition this team is in.
  const [team, player, competitionTeams, existingMemberships] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
    prisma.player.findUnique({ where: { id: playerId }, include: { dispensations: true } }),
    prisma.competitionTeam.findMany({ where: { teamId }, include: { competition: true } }),
    prisma.teamPlayer.findMany({
      where: { playerId },
      include: { team: { include: { competitions: { include: { competition: { select: { id: true, name: true } } } } } } },
    }),
  ]);
  if (!player || !team) return NextResponse.json({ error: "Player or team not found" }, { status: 404 });
  const playerName = `${player.firstName} ${player.lastName}`;

  const blocked = (error: string, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ error, overridable: canOverride, ...extra }, { status: 409 });

  // Rule 22.1 — a player cannot be in two teams in the same competition.
  const thisTeamCompIds = new Set(competitionTeams.map((ct) => ct.competitionId));
  const overridden: string[] = [];
  for (const m of existingMemberships) {
    const clash = m.team.competitions.find((tc) => thisTeamCompIds.has(tc.competition.id));
    if (clash) {
      const reason = `${playerName} already plays for ${m.team.name} in ${clash.competition.name} — a player cannot be in two teams in the same competition (rule 22.1).`;
      if (!overriding) return blocked(reason);
      overridden.push(reason);
    }
  }

  // First team = primary (covered by registration). Any further team is an
  // additional team and attracts the $135 additional-team fee.
  const isPrimary = existingMemberships.length === 0;

  const approvals: { competitionId: string; type: DispensationType; result: EligibilityResult }[] = [];
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
      const reason = `${playerName} is not eligible for ${ct.competition.name}: ${result.reason}`;
      if (!overriding) {
        return blocked(reason, { requiresDispensation: result.requires, competitionId: ct.competitionId });
      }
      overridden.push(reason);
      approvals.push({ competitionId: ct.competitionId, type: approvalTypeFor(result), result });
    }
  }

  // Record the approval so the placement stays valid (and visible) later.
  const recorded = [];
  for (const a of approvals) {
    const dispensation = await prisma.dispensation.upsert({
      where: { playerId_competitionId: { playerId, competitionId: a.competitionId } },
      update: { type: a.type, approvedBy: session.user.name, note: overrideReason },
      create: { playerId, competitionId: a.competitionId, type: a.type, approvedBy: session.user.name, note: overrideReason },
    });
    recorded.push(dispensation);
    await audit(session, {
      action: "eligibility.override",
      summary: `Approved ${playerName} for ${team.name} despite rules (${a.type.replace("_", " ").toLowerCase()}): ${overrideReason}`,
      entityType: "Dispensation",
      entityId: dispensation.id,
      details: { playerId, teamId, competitionId: a.competitionId, type: a.type, reason: overrideReason, blockedBy: !a.result.eligible ? a.result.reason : null },
    });
  }
  if (overriding && approvals.length === 0 && overridden.length > 0) {
    // Rule 22.1 only — nothing to record as a dispensation.
    await audit(session, {
      action: "eligibility.override",
      summary: `Approved ${playerName} for ${team.name} despite rules: ${overrideReason}`,
      entityType: "Player",
      entityId: playerId,
      details: { playerId, teamId, reason: overrideReason, blockedBy: overridden },
    });
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

  await audit(session, {
    action: "team.player.add",
    summary: `Added ${playerName} to ${team.name}${overridden.length ? " (rules overridden)" : ""}`,
    entityType: "Team",
    entityId: teamId,
    details: { playerId, jerseyNumber: teamPlayer.jerseyNumber, isPrimary, overridden },
  });

  return NextResponse.json({ ...teamPlayer, dispensations: recorded }, { status: 201 });
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
  if (jerseyNumber !== undefined) data.jerseyNumber = jerseyNumber ? Number(jerseyNumber) : null;

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
