import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { generateRoundRobin, scheduleFixtures } from "@/lib/draw";

export async function POST(req: Request) {
  try {
    await requireAdmin();
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
      teams: { include: { team: true } },
      timeSlots: { include: { pitch: true } },
    },
  });

  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  if (competition.teams.length < 2) {
    return NextResponse.json({ error: "Need at least 2 teams to generate a draw" }, { status: 400 });
  }
  if (competition.timeSlots.length === 0) {
    return NextResponse.json({ error: "No time slots configured for this competition" }, { status: 400 });
  }

  // Clear existing scheduled fixtures for this competition
  await prisma.fixture.deleteMany({
    where: { competitionId, phase: "REGULAR", status: "SCHEDULED" },
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

  const fixtures = scheduleFixtures(competitionId, rounds, slots, new Date(startDate));

  await prisma.fixture.createMany({
    data: fixtures.map((f) => ({
      ...f,
      competitionId,
      phase: "REGULAR",
      status: "SCHEDULED",
    })),
  });

  await prisma.competition.update({
    where: { id: competitionId },
    data: { status: "ACTIVE" },
  });

  return NextResponse.json({ fixtures: fixtures.length, rounds: rounds.length });
}
