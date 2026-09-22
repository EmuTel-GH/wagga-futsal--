import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { checkEligibility } from "@/lib/eligibility";

// Dispensations: admin-recorded approvals for playing outside the registered
// age group (PLAY_UP: rule 7.2 consent form; PLAY_DOWN: rule 7.5, female
// players in mixed/open comps, one group down). approvedBy records who signed
// it off (e.g. Sam or Amanda).

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playerId, competitionId, type, approvedBy, note } = await req.json();
  if (!playerId || !competitionId || !type || !approvedBy) {
    return NextResponse.json(
      { error: "playerId, competitionId, type (PLAY_UP|PLAY_DOWN) and approvedBy are required" },
      { status: 400 }
    );
  }

  const [player, competition] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.competition.findUnique({ where: { id: competitionId } }),
  ]);
  if (!player || !competition) {
    return NextResponse.json({ error: "Player or competition not found" }, { status: 404 });
  }

  // Only record dispensations the rules actually allow (e.g. never >1 group down,
  // never below minimum age, never male into female-only).
  const would = checkEligibility({
    dateOfBirth: player.dateOfBirth,
    gender: player.gender,
    registeredAgeGroup: player.registeredAgeGroup,
    competition,
    dispensation: { type },
  });
  if (!would.eligible) {
    return NextResponse.json(
      { error: `A ${type} approval cannot make this placement legal: ${would.reason}` },
      { status: 409 }
    );
  }

  const dispensation = await prisma.dispensation.upsert({
    where: { playerId_competitionId: { playerId, competitionId } },
    update: { type, approvedBy, note: note || null },
    create: { playerId, competitionId, type, approvedBy, note: note || null },
  });

  return NextResponse.json(dispensation, { status: 201 });
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  const competitionId = searchParams.get("competitionId");
  if (!playerId || !competitionId) {
    return NextResponse.json({ error: "playerId and competitionId query params required" }, { status: 400 });
  }

  await prisma.dispensation.deleteMany({ where: { playerId, competitionId } });
  return NextResponse.json({ ok: true });
}
