import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    await requireAdmin();
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
    include: { competition: { select: { id: true, name: true, season: true } } },
  });

  return NextResponse.json(competitionTeam, { status: 201 });
}

// Remove the team from its competition (so it can be moved).
export async function DELETE(req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { searchParams } = new URL(req.url);
  const competitionId = searchParams.get("competitionId");
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId query param required" }, { status: 400 });
  }

  await prisma.competitionTeam.deleteMany({ where: { teamId, competitionId } });
  return NextResponse.json({ ok: true });
}
