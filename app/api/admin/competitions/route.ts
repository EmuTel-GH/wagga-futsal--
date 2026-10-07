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

  const competitions = await prisma.competition.findMany({
    include: {
      timeSlots: { include: { pitch: { include: { venue: true } } } },
      teams: { include: { team: true } },
      _count: { select: { fixtures: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(competitions);
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, season, ageGroup, gender, status } = await req.json();

  if (!name || !season || !ageGroup || !gender) {
    return NextResponse.json({ error: "name, season, ageGroup and gender are required" }, { status: 400 });
  }

  const competition = await prisma.competition.create({
    data: {
      name,
      season,
      ageGroup,
      gender,
      status: status ?? "REGISTRATION",
    },
    include: {
      timeSlots: true,
      teams: { include: { team: true } },
      _count: { select: { fixtures: true } },
    },
  });

  await audit(session, {
    action: "competition.create",
    summary: `Created competition ${competition.name} (${competition.season})`,
    entityType: "Competition",
    entityId: competition.id,
    details: { name, season, ageGroup, gender, status: competition.status },
  });

  return NextResponse.json(competition, { status: 201 });
}
