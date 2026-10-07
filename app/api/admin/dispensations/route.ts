import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { checkEligibility } from "@/lib/eligibility";

// Dispensations: admin-recorded approvals for playing outside the registered
// age group (PLAY_UP: rule 7.2 consent form; PLAY_DOWN: rule 7.5, female
// players in mixed/open comps, one group down). approvedBy records who signed
// it off (e.g. Sam or Amanda).

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
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

  if (type === "OVERRIDE" && !hasPermission(session.user, "OVERRIDE_RULES")) {
    return NextResponse.json({ error: "You don't have permission to override eligibility rules." }, { status: 403 });
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

  await audit(session, {
    action: type === "OVERRIDE" ? "eligibility.override" : "dispensation.record",
    summary: `Recorded ${type.replace("_", " ").toLowerCase()} approval for ${player.firstName} ${player.lastName} in ${competition.name} (approved by ${approvedBy})`,
    entityType: "Dispensation",
    entityId: dispensation.id,
    details: { playerId, competitionId, type, approvedBy, note },
  });

  return NextResponse.json(dispensation, { status: 201 });
}

export async function DELETE(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  const competitionId = searchParams.get("competitionId");
  if (!playerId || !competitionId) {
    return NextResponse.json({ error: "playerId and competitionId query params required" }, { status: 400 });
  }

  const removed = await prisma.dispensation.findMany({
    where: { playerId, competitionId },
    include: { player: { select: { firstName: true, lastName: true } }, competition: { select: { name: true } } },
  });
  await prisma.dispensation.deleteMany({ where: { playerId, competitionId } });
  for (const d of removed) {
    await audit(session, {
      action: "dispensation.delete",
      summary: `Withdrew ${d.type.replace("_", " ").toLowerCase()} approval for ${d.player.firstName} ${d.player.lastName} in ${d.competition.name}`,
      entityType: "Dispensation",
      entityId: d.id,
      details: d,
    });
  }
  return NextResponse.json({ ok: true });
}
