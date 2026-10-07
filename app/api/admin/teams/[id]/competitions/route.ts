import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

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
  await prisma.competitionTeam.deleteMany({ where: { teamId, competitionId } });
  await audit(session, {
    action: "team.competition.remove",
    summary: `Removed ${team?.name ?? "team"} from ${competition?.name ?? "competition"}`,
    entityType: "Team",
    entityId: teamId,
    details: { competitionId },
  });
  return NextResponse.json({ ok: true });
}
