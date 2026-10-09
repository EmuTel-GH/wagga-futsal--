import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getStandings } from "@/lib/standings";
import { generateFinals } from "@/lib/draw";
import { finalsState } from "@/lib/finals";

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Semis: same time on two pitches (secondPitchId), or back-to-back on one.
  // Grand final: date + pitch saved now; the GF itself is created when both
  // semis have a winner (same night for juniors, a week later for seniors).
  const { competitionId, semifinalDate, pitchId, secondPitchId, grandFinalDate, grandFinalPitchId } = await req.json();

  if (!competitionId || !semifinalDate || !pitchId) {
    return NextResponse.json({ error: "competitionId, semifinalDate and pitchId required" }, { status: 400 });
  }

  const standings = await getStandings(competitionId);

  if (standings.length < 4) {
    return NextResponse.json({ error: "Need at least 4 teams in standings to generate finals" }, { status: 400 });
  }

  const finalFixtures = generateFinals(
    competitionId,
    standings,
    new Date(semifinalDate),
    pitchId
  );

  // Remove TBD grand final placeholder — created after semis are played
  const definite = finalFixtures.filter((f) => f.homeTeamId !== "TBD");
  if (secondPitchId && secondPitchId !== pitchId) {
    definite[1] = { ...definite[1], pitchId: secondPitchId, scheduledAt: definite[0].scheduledAt };
  }
  if (grandFinalDate && new Date(grandFinalDate) <= new Date(semifinalDate)) {
    return NextResponse.json({ error: "The grand final has to be after the semi-finals" }, { status: 400 });
  }
  // Starting finals again replaces unplayed semis (e.g. after a date change).
  await prisma.fixture.deleteMany({
    where: { competitionId, phase: { in: ["SEMI_FINAL", "GRAND_FINAL"] }, status: { in: ["DRAFT", "SCHEDULED"] } },
  });

  await prisma.fixture.createMany({
    data: definite.map((f) => ({
      ...f,
      // Like the draw, finals start as drafts until an admin publishes them.
      status: "DRAFT",
    })),
  });

  await prisma.competition.update({
    where: { id: competitionId },
    data: {
      status: "FINALS",
      finalsGrandFinalAt: grandFinalDate ? new Date(grandFinalDate) : null,
      finalsGrandFinalPitchId: grandFinalDate ? grandFinalPitchId || pitchId : null,
    },
  });

  await audit(session, {
    action: "competition.finals.generate",
    summary: `Started finals: ${standings[0].teamName} v ${standings[3].teamName}, ${standings[1].teamName} v ${standings[2].teamName}`,
    entityType: "Competition",
    entityId: competitionId,
    details: { semifinalDate, pitchId, secondPitchId, grandFinalDate, grandFinalPitchId, created: definite.length },
  });

  return NextResponse.json({
    created: definite.length,
    semifinals: [
      `${standings[0].teamName} vs ${standings[3].teamName}`,
      `${standings[1].teamName} vs ${standings[2].teamName}`,
    ],
  });
}

// Finals status for the Competitions page: semis (with winners), grand final, plan.
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const competitionId = new URL(req.url).searchParams.get("competitionId");
  if (!competitionId) return NextResponse.json({ error: "competitionId required" }, { status: 400 });
  const teamNames = new Map(
    (await prisma.team.findMany({ where: { OR: [{ homeFixtures: { some: { competitionId } } }, { awayFixtures: { some: { competitionId } } }] }, select: { id: true, name: true } })).map((t) => [t.id, t.name])
  );
  const { competition, semis, grandFinal, winners } = await finalsState(competitionId);
  const view = (f: { id: string; homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number; status: string; scheduledAt: Date }) => ({
    id: f.id, home: { id: f.homeTeamId, name: teamNames.get(f.homeTeamId) }, away: { id: f.awayTeamId, name: teamNames.get(f.awayTeamId) },
    homeScore: f.homeScore, awayScore: f.awayScore, status: f.status, scheduledAt: f.scheduledAt,
  });
  return NextResponse.json({
    semis: semis.map((s, i) => ({ ...view(s), winnerId: winners[i] })),
    grandFinal: grandFinal ? view(grandFinal) : null,
    planned: { at: competition?.finalsGrandFinalAt ?? null, pitchId: competition?.finalsGrandFinalPitchId ?? null },
  });
}
