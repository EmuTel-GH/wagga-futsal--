import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { finalsState } from "@/lib/finals";

// Create the grand final by hand: for a semi decided on penalties (a drawn
// score), or to change who's in it. Defaults to the planned date/pitch.
export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { competitionId, homeTeamId, awayTeamId, scheduledAt, pitchId } = await req.json();
  if (!competitionId || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
    return NextResponse.json({ error: "Pick the two grand finalists" }, { status: 400 });
  }
  const { competition, semis, grandFinal } = await finalsState(competitionId);
  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  if (grandFinal) return NextResponse.json({ error: "The grand final already exists — edit it on the Fixtures page." }, { status: 409 });
  const finalists = new Set(semis.flatMap((s) => [s.homeTeamId, s.awayTeamId]));
  if (!finalists.has(homeTeamId) || !finalists.has(awayTeamId)) {
    return NextResponse.json({ error: "Both teams must come from the semi-finals" }, { status: 400 });
  }
  const when = scheduledAt ? new Date(scheduledAt) : competition.finalsGrandFinalAt;
  const where = pitchId || competition.finalsGrandFinalPitchId || semis[0]?.pitchId;
  if (!when || !where) return NextResponse.json({ error: "Set the grand final date and pitch" }, { status: 400 });

  const gf = await prisma.fixture.create({
    data: { competitionId, homeTeamId, awayTeamId, pitchId: where, scheduledAt: when, round: 2, phase: "GRAND_FINAL", status: "SCHEDULED" },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });
  await audit(session, {
    action: "competition.finals.grand_final",
    summary: `Created the ${competition.name} grand final: ${gf.homeTeam.name} v ${gf.awayTeam.name}`,
    entityType: "Fixture",
    entityId: gf.id,
    details: { competitionId, homeTeamId, awayTeamId, scheduledAt: when, pitchId: where, manual: true },
  });
  return NextResponse.json(gf, { status: 201 });
}
