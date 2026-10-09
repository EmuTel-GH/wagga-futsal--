import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { approvalTypeFor } from "@/lib/eligibility";
import { rosterProblems } from "@/lib/teamPlayers";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { competitionId } = await req.json();

  if (!competitionId) {
    return NextResponse.json({ error: "competitionId is required" }, { status: 400 });
  }

  // A team is bound to exactly one competition.
  const existing = await prisma.competitionTeam.findFirst({
    where: { teamId },
    include: { competition: { select: { name: true } } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `This team is already registered in ${existing.competition.name}. Teams belong to one competition — remove it from that competition first, or create a separate team.` },
      { status: 409 }
    );
  }

  const competitionTeam = await prisma.competitionTeam.create({
    data: { teamId, competitionId },
    include: { competition: { select: { id: true, name: true, season: true, ageGroup: true, gender: true } } },
  });

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  await audit(session, {
    action: "team.competition.add",
    summary: `Entered ${team?.name ?? "team"} into ${competitionTeam.competition.name}`,
    entityType: "Team",
    entityId: teamId,
    details: { competitionId },
  });

  return NextResponse.json(competitionTeam, { status: 201 });
}

// Remove the team from its competition (so it can be moved).
export async function DELETE(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { searchParams } = new URL(req.url);
  const competitionId = searchParams.get("competitionId");
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId query param required" }, { status: 400 });
  }

  const [team, competition] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
    prisma.competition.findUnique({ where: { id: competitionId }, select: { name: true } }),
  ]);
  // Its unplayed fixtures in that competition go too (played ones are kept).
  await prisma.$transaction([
    prisma.fixture.deleteMany({
      where: { competitionId, status: { in: ["DRAFT", "SCHEDULED"] }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    }),
    prisma.competitionTeam.deleteMany({ where: { teamId, competitionId } }),
  ]);
  await audit(session, {
    action: "team.competition.remove",
    summary: `Removed ${team?.name ?? "team"} from ${competition?.name ?? "competition"}`,
    entityType: "Team",
    entityId: teamId,
    details: { competitionId },
  });
  return NextResponse.json({ ok: true });
}

// Re-grade: move the team to another competition, or take it out of its
// competition ({ competitionId: null }). The team's unplayed fixtures in the
// old competition are deleted (played results stay there), so both draws
// usually need regenerating. Players who'd break the new competition's rules
// block the move unless an admin with OVERRIDE_RULES gives a reason, which is
// recorded as a dispensation per player, like adding a player.
export async function PUT(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { competitionId, override } = await req.json();
  const target: string | null = competitionId || null;
  const canOverride = hasPermission(session.user, "OVERRIDE_RULES");
  const reason = typeof override?.reason === "string" ? override.reason.trim() : "";
  if (override && !canOverride) {
    return NextResponse.json({ error: "You don't have permission to override eligibility rules." }, { status: 403 });
  }
  if (override && reason.length < 3) return NextResponse.json({ error: "Give a reason for the override." }, { status: 400 });

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { competitions: { include: { competition: { select: { id: true, name: true } } } } },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  const current = team.competitions[0]?.competition ?? null;
  if ((current?.id ?? null) === target) {
    return NextResponse.json({ error: "The team is already there." }, { status: 400 });
  }

  let newComp: { id: string; name: string } | null = null;
  let approvals: { playerId: string; name: string; reason: string; type: "PLAY_UP" | "PLAY_DOWN" | "OVERRIDE" }[] = [];
  if (target) {
    const { competition, problems } = await rosterProblems(teamId, target);
    if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    if (competition.status === "COMPLETED") {
      return NextResponse.json({ error: `${competition.name} is completed.` }, { status: 409 });
    }
    newComp = competition;
    if (problems.length && !override) {
      return NextResponse.json(
        {
          error: `${problems.length} player${problems.length === 1 ? "" : "s"} can't play in ${competition.name}: ${problems.map((p) => `${p.name} (${p.reason})`).join("; ")}.`,
          overridable: canOverride,
        },
        { status: 409 }
      );
    }
    approvals = problems
      .filter((p) => p.result)
      .map((p) => ({ playerId: p.playerId, name: p.name, reason: p.reason, type: approvalTypeFor(p.result!) }));
  }

  const result = await prisma.$transaction(async (tx) => {
    let removedFixtures = 0;
    if (current) {
      removedFixtures = (
        await tx.fixture.deleteMany({
          where: { competitionId: current.id, status: { in: ["DRAFT", "SCHEDULED"] }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
        })
      ).count;
      await tx.competitionTeam.deleteMany({ where: { teamId } });
    }
    const competitionTeam = newComp
      ? await tx.competitionTeam.create({
          data: { teamId, competitionId: newComp.id },
          include: { competition: { select: { id: true, name: true, season: true, ageGroup: true, gender: true } } },
        })
      : null;
    const dispensations = [];
    for (const a of approvals) {
      dispensations.push(
        await tx.dispensation.upsert({
          where: { playerId_competitionId: { playerId: a.playerId, competitionId: newComp!.id } },
          update: { type: a.type, approvedBy: session.user.name, note: reason },
          create: { playerId: a.playerId, competitionId: newComp!.id, type: a.type, approvedBy: session.user.name, note: reason },
        })
      );
    }
    return { removedFixtures, competitionTeam, dispensations };
  });

  for (const a of approvals) {
    await audit(session, {
      action: "eligibility.override",
      summary: `Approved ${a.name} for ${team.name} in ${newComp!.name} despite rules (${a.type.replace("_", " ").toLowerCase()}): ${reason}`,
      entityType: "Player",
      entityId: a.playerId,
      details: { teamId, competitionId: newComp!.id, type: a.type, reason, blockedBy: a.reason },
    });
  }
  await audit(session, {
    action: newComp ? "team.regrade" : "team.competition.remove",
    summary: newComp
      ? `Moved ${team.name} from ${current?.name ?? "no competition"} to ${newComp.name}${result.removedFixtures ? ` (${result.removedFixtures} unplayed fixtures removed from ${current?.name})` : ""}`
      : `Removed ${team.name} from ${current?.name}${result.removedFixtures ? ` and its ${result.removedFixtures} unplayed fixtures` : ""}`,
    entityType: "Team",
    entityId: teamId,
    details: { from: current, to: newComp, removedFixtures: result.removedFixtures, overridden: approvals.map((a) => a.name) },
  });

  return NextResponse.json({ ...result, from: current });
}
