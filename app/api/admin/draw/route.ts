import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateRoundRobin, scheduleFixtures } from "@/lib/draw";
import { breaksForCompetition, sydneyDateKey } from "@/lib/breaks";
import { applyDrawRequests, describeRequest } from "@/lib/drawRequestsDb";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROUNDS = 200; // a safety cap for "keep going until the end date"

// Generate a competition's regular-season draw as DRAFT fixtures.
//   timesEach  — how many times every pair meets (null = keep cycling to endDate)
//   maxRounds  — stop after this many rounds (e.g. one round before a split)
//   endDate    — no games after this day, whatever the other settings
// At least one of timesEach / endDate is required, so a draw always ends.
export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { competitionId, startDate } = body;
  const timesEach = body.timesEach == null || body.timesEach === "" ? null : Number(body.timesEach);
  const maxRounds = body.maxRounds == null || body.maxRounds === "" ? null : Number(body.maxRounds);
  const endDate = body.endDate ? String(body.endDate) : null;

  if (!competitionId || !startDate) {
    return NextResponse.json({ error: "competitionId and startDate required" }, { status: 400 });
  }
  if (timesEach !== null && !(Number.isInteger(timesEach) && timesEach >= 1 && timesEach <= 10)) {
    return NextResponse.json({ error: "Times each team plays the others must be 1–10" }, { status: 400 });
  }
  if (maxRounds !== null && !(Number.isInteger(maxRounds) && maxRounds >= 1 && maxRounds <= MAX_ROUNDS)) {
    return NextResponse.json({ error: `Number of rounds must be 1–${MAX_ROUNDS}` }, { status: 400 });
  }
  if (endDate !== null && (!DAY.test(endDate) || endDate < String(startDate))) {
    return NextResponse.json({ error: "The end date must be on or after the start date" }, { status: 400 });
  }
  if (timesEach === null && endDate === null && maxRounds === null) {
    return NextResponse.json(
      { error: "Choose how many times teams play each other, a number of rounds, or an end date — otherwise the draw never ends" },
      { status: 400 }
    );
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

  const teams = competition.teams.map((ct) => ({ id: ct.teamId }));
  const roundsPerCycle = teams.length % 2 === 0 ? teams.length - 1 : teams.length;
  // "Until the end date" = as many cycles as could possibly fit; the end date trims it.
  const cycles = timesEach ?? Math.ceil(MAX_ROUNDS / roundsPerCycle);
  let rounds = generateRoundRobin(teams, cycles);
  rounds = rounds.slice(0, Math.min(maxRounds ?? MAX_ROUNDS, MAX_ROUNDS));
  const slots = competition.timeSlots.map((s) => ({
    pitchId: s.pitchId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    durationMins: s.durationMins,
  }));

  const breaks = await breaksForCompetition(competitionId);
  const { fixtures, skipped, roundsPlaced, stoppedAtEndDate } = scheduleFixtures(
    competitionId,
    rounds,
    slots,
    new Date(startDate),
    breaks,
    { endDate }
  );
  if (fixtures.length === 0) {
    return NextResponse.json({ error: "No rounds fit between the start date and the end date" }, { status: 400 });
  }
  const skippedWeeks = skipped.map((s) => ({ weekOf: sydneyDateKey(s.date), breakName: s.breakName }));

  // Replace any unplayed regular-season fixtures (draft or published).
  await prisma.fixture.deleteMany({
    where: { competitionId, phase: "REGULAR", status: { in: ["DRAFT", "SCHEDULED"] } },
  });
  await prisma.fixture.createMany({
    data: fixtures.map((f) => ({
      ...f,
      competitionId,
      phase: "REGULAR",
      // Drafts stay off the website until an admin reviews and publishes them.
      status: "DRAFT",
    })),
  });
  // Saved draw requests ("A v B on…", "A's bye on…"): re-order the new rounds to meet them.
  const applied = await applyDrawRequests(competitionId, { dryRun: false });
  const requestResults = applied.results.map((r) => ({ ...r, label: describeRequest(applied.requests.find((q) => q.id === r.id)!) }));

  // Remember the settings for next time (and show the end date publicly).
  await prisma.competition.update({
    where: { id: competitionId },
    data: {
      drawTimesEach: timesEach,
      drawMaxRounds: maxRounds,
      endDate: endDate ? new Date(`${endDate}T00:00:00Z`) : null,
    },
  });

  // How far through the round-robin the draw gets: full cycles + extra rounds.
  const fullCycles = Math.floor(roundsPlaced / roundsPerCycle);
  const extraRounds = roundsPlaced % roundsPerCycle;
  const lastGame = sydneyDateKey(fixtures[fixtures.length - 1].scheduledAt);
  const shortOfTarget = timesEach !== null && maxRounds === null && stoppedAtEndDate;

  await audit(session, {
    action: "competition.draw.generate",
    summary:
      `Generated a draft draw for ${competition.name}: ${fixtures.length} fixtures over ${roundsPlaced} rounds, ${startDate} to ${lastGame}` +
      (skipped.length ? `, skipping ${skipped.length} week${skipped.length === 1 ? "" : "s"} for breaks` : ""),
    entityType: "Competition",
    entityId: competitionId,
    details: { startDate, timesEach, maxRounds, endDate, teams: teams.length, fixtures: fixtures.length, rounds: roundsPlaced, lastGame, fullCycles, extraRounds, stoppedAtEndDate, skippedWeeks, requests: requestResults },
  });

  return NextResponse.json({
    fixtures: fixtures.length,
    rounds: roundsPlaced,
    roundsPerCycle,
    fullCycles,
    extraRounds,
    lastGame,
    stoppedAtEndDate,
    shortOfTarget,
    skippedWeeks,
    requests: requestResults,
  });
}
