import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReferee } from "@/lib/auth";
import { audit } from "@/lib/audit";
const VALID_STATUSES = ["SCHEDULED", "LIVE", "COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY", "ABANDONED"] as const;
type FixtureStatus = typeof VALID_STATUSES[number];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireReferee();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const fixture = await prisma.fixture.update({
    where: { id },
    data: { status: status as FixtureStatus },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });
  await audit(session, {
    action: "fixture.status",
    summary: `Set ${fixture.homeTeam.name} v ${fixture.awayTeam.name} to ${status.replace("_", " ").toLowerCase()}`,
    entityType: "Fixture",
    entityId: id,
    details: { status, homeScore: fixture.homeScore, awayScore: fixture.awayScore },
  });

  return NextResponse.json(fixture);
}
