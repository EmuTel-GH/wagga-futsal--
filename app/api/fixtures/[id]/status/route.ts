import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReferee } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { maybeCreateGrandFinal } from "@/lib/finals";
import { fixtureAccess } from "@/lib/fixtureAccess";
import { callerFor } from "@/lib/callerContext";
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

  const current = await prisma.fixture.findUnique({ where: { id }, select: { status: true, fieldRefereeId: true, scorerId: true } });
  if (!current) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  // Only the assigned referee/scorer (or an admin); finished games: admins only.
  const access = fixtureAccess(await callerFor(session), current);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

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


  // Both semis decided? Create the planned grand final.
  if (fixture.phase === "SEMI_FINAL") {
    const gf = await maybeCreateGrandFinal(fixture.competitionId);
    if (gf) {
      await audit(session, {
        action: "competition.finals.grand_final",
        summary: `Grand final set: ${gf.homeTeam.name} v ${gf.awayTeam.name}`,
        entityType: "Fixture",
        entityId: gf.id,
        details: { competitionId: fixture.competitionId, automatic: true },
      });
    }
  }

  return NextResponse.json(fixture);
}
