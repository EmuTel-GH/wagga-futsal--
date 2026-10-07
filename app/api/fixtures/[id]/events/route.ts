import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReferee } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";
type EventType = "GOAL" | "YELLOW_CARD" | "RED_CARD" | "FOUL";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireReferee();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: fixtureId } = await params;
  const body = await req.json();
  const { teamId, type, minute, half, playerName, jerseyNumber, playerId } = body;

  if (!teamId || !type || minute == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });

  // Create the event
  const event = await prisma.matchEvent.create({
    data: {
      fixtureId,
      teamId,
      type: type as EventType,
      minute: Number(minute),
      half: Number(half ?? 1),
      playerName: playerName ?? null,
      jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
      playerId: playerId ?? null,
    },
    include: { team: true },
  });

  // Update score or foul counts
  if (type === "GOAL") {
    const isHome = teamId === fixture.homeTeamId;
    await prisma.fixture.update({
      where: { id: fixtureId },
      data: isHome ? { homeScore: { increment: 1 } } : { awayScore: { increment: 1 } },
    });
  }

  if (type === "FOUL") {
    const isHome = teamId === fixture.homeTeamId;
    const halfNum = Number(half ?? 1);
    await prisma.fixture.update({
      where: { id: fixtureId },
      data: isHome
        ? halfNum === 1 ? { homeFoulsH1: { increment: 1 } } : { homeFoulsH2: { increment: 1 } }
        : halfNum === 1 ? { awayFoulsH1: { increment: 1 } } : { awayFoulsH2: { increment: 1 } },
    });
  }

  // Auto-update fixture status to LIVE on first event
  if (fixture.status === "SCHEDULED") {
    await prisma.fixture.update({ where: { id: fixtureId }, data: { status: "LIVE" } });
  }

  await audit(session, {
    action: "fixture.event.add",
    summary: `Recorded ${type.replace("_", " ").toLowerCase()} for ${event.team.name}${playerName ? ` (${playerName})` : ""}, half ${event.half}, ${event.minute}'`,
    entityType: "Fixture",
    entityId: fixtureId,
    details: { eventId: event.id, teamId, type, minute, half, playerName, jerseyNumber, playerId },
  });

  return NextResponse.json(event, { status: 201 });
}
