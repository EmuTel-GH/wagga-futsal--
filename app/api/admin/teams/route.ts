import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teams = await prisma.team.findMany({
    include: {
      _count: { select: { players: true } },
      competitions: {
        include: { competition: { select: { id: true, name: true, season: true, ageGroup: true, gender: true } } },
      },
      players: {
        include: { player: true },
        orderBy: { jerseyNumber: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(teams);
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, contactName, contactEmail, contactPhone, kitShirt, kitShorts, kitSocks } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const team = await prisma.team.create({
    data: {
      name,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      kitShirt: kitShirt || null,
      kitShorts: kitShorts || null,
      kitSocks: kitSocks || null,
    },
    include: {
      _count: { select: { players: true } },
      competitions: { include: { competition: { select: { id: true, name: true, season: true, ageGroup: true, gender: true } } } },
      players: { include: { player: true } },
    },
  });

  await audit(session, {
    action: "team.create",
    summary: `Created team ${team.name}`,
    entityType: "Team",
    entityId: team.id,
    details: { name, contactName, contactEmail, contactPhone, kitShirt, kitShorts, kitSocks },
  });

  return NextResponse.json(team, { status: 201 });
}
