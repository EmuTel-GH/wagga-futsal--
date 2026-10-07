import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateRoundRobin, scheduleFixtures } from "@/lib/draw";
import { breaksForCompetition, sydneyDateKey } from "@/lib/breaks";

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { competitionId, startDate } = await req.json();

  if (!competitionId || !startDate) {
    return NextResponse.json({ error: "competitionId and startDate required" }, { status: 400 });
  }

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      // Pending nominations don't play — approve or merge them first.
      teams: { where: { team: { status: "APPROVED" } }, include: { team: true } },
      timeSlots: { include: { pitch: true } },
    },
  });

  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  if (competition.teams.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 approved teams to generate a draw (pending nominations are excluded)" },
      { status: 400 }
    );
  }
  if (competition.timeSlots.length === 0) {
    return NextResponse.json({ error: "No time slots configured for this competition" }, { status: 400 });
  }

  // Replace any unplayed regular-season fixtures (draft or published).
  await prisma.fixture.deleteMany({
    where: { competitionId, phase: "REGULAR", status: { in: ["DRAFT", "SCHEDULED"] } },
  });

  const teams = competition.teams.map((ct) => ({ id: ct.teamId }));
  // Teams meet twice per season; Opens meet three times.
  const cycles = competition.ageGroup === "OPENS" ? 3 : 2;
  const rounds = generateRoundRobin(teams, cycles);
  const slots = competition.timeSlots.map((s) => ({
    pitchId: s.pitchId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    durationMins: s.durationMins,
  }));

  const breaks = await breaksForCompetition(competitionId);
  const { fixtures, skipped } = scheduleFixtures(competitionId, rounds, slots, new Date(startDate), breaks);
  const skippedWeeks = skipped.map((s) => ({ weekOf: sydneyDateKey(s.date), breakName: s.breakName }));

  await prisma.fixture.createMany({
    data: fixtures.map((f) => ({
      ...f,
      competitionId,
      phase: "REGULAR",
      // Drafts stay off the website until an admin reviews and publishes them.
      status: "DRAFT",
    })),
  });

  await audit(session, {
    action: "competition.draw.generate",
    summary: `Generated a draft draw for ${competition.name}: ${fixtures.length} fixtures over ${rounds.length} rounds from ${startDate}${skipped.length ? `, skipping ${skipped.length} week${skipped.length === 1 ? "" : "s"} for breaks` : ""}`,
    entityType: "Competition",
    entityId: competitionId,
    details: { startDate, teams: teams.length, fixtures: fixtures.length, rounds: rounds.length, skippedWeeks },
  });

  return NextResponse.json({ fixtures: fixtures.length, rounds: rounds.length, skippedWeeks });
}
