import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.futsalSession.findMany({
    include: {
      pitch: { select: { id: true, name: true } },
      _count: { select: { bookings: true } },
      bookings: {
        where: { status: "CONFIRMED" },
        select: { participantCount: true },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description, scheduledAt, durationMins, capacityMax, priceCents, status, pitchId } =
    await req.json();

  if (!title || !scheduledAt || !capacityMax || priceCents === undefined) {
    return NextResponse.json(
      { error: "title, scheduledAt, capacityMax and priceCents are required" },
      { status: 400 }
    );
  }

  const session = await prisma.futsalSession.create({
    data: {
      title,
      description: description || null,
      scheduledAt: new Date(scheduledAt),
      durationMins: durationMins ?? 60,
      capacityMax: Number(capacityMax),
      priceCents: Number(priceCents),
      status: status ?? "OPEN",
      pitchId: pitchId || null,
    },
    include: {
      pitch: { select: { id: true, name: true } },
      _count: { select: { bookings: true } },
      bookings: { where: { status: "CONFIRMED" }, select: { participantCount: true } },
    },
  });

  return NextResponse.json(session, { status: 201 });
}
