import type { Dispensation, DispensationType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { audit } from "./audit";
import type { AuthSession } from "./auth";
import { approvalTypeFor, checkEligibility, type EligibilityResult } from "./eligibility";

export type AddPlayerResult =
  | {
      ok: true;
      teamPlayer: Prisma.TeamPlayerGetPayload<{ include: { player: true } }>;
      dispensations: Dispensation[];
    }
  | { ok: false; status: 404 | 409; error: string; requiresDispensation?: DispensationType | null; competitionId?: string };

/**
 * Add a player to a team, enforcing age eligibility (rules 7.2/7.4/7.5) and
 * rule 22.1. With `overrideReason` (caller must have checked OVERRIDE_RULES)
 * blocks are let through: the approval is recorded as a Dispensation and the
 * override is audited. Shared by the single-add route and bulk authorise.
 */
export async function addPlayerToTeam(
  session: AuthSession,
  opts: { teamId: string; playerId: string; jerseyNumber?: unknown; additionalFeePaid?: unknown; overrideReason?: string }
): Promise<AddPlayerResult> {
  const { teamId, playerId, jerseyNumber, additionalFeePaid } = opts;
  const overrideReason = opts.overrideReason ?? "";
  const overriding = Boolean(opts.overrideReason);

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
  if (!player || !team) return { ok: false, status: 404, error: "Player or team not found" };
  const playerName = `${player.firstName} ${player.lastName}`;

  // Rule 22.1 — a player cannot be in two teams in the same competition.
  const thisTeamCompIds = new Set(competitionTeams.map((ct) => ct.competitionId));
  const overridden: string[] = [];
  for (const m of existingMemberships) {
    const clash = m.team.competitions.find((tc) => thisTeamCompIds.has(tc.competition.id));
    if (clash) {
      const reason = `${playerName} already plays for ${m.team.name} in ${clash.competition.name} — a player cannot be in two teams in the same competition (rule 22.1).`;
      if (!overriding) return { ok: false, status: 409, error: reason };
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
        return { ok: false, status: 409, error: reason, requiresDispensation: result.requires, competitionId: ct.competitionId };
      }
      overridden.push(reason);
      approvals.push({ competitionId: ct.competitionId, type: approvalTypeFor(result), result });
    }
  }

  // Record the approval so the placement stays valid (and visible) later.
  const recorded: Dispensation[] = [];
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

  return { ok: true, teamPlayer, dispensations: recorded };
}
