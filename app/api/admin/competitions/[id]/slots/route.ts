import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: competitionId } = await params;
  const { pitchId, dayOfWeek, startTime, durationMins } = await req.json();

  if (!pitchId || dayOfWeek === undefined || !startTime) {
    return NextResponse.json(
      { error: "pitchId, dayOfWeek and startTime are required" },
      { status: 400 }
    );
  }

  const slot = await prisma.competitionTimeSlot.create({
    data: {
      competitionId,
      pitchId,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      durationMins: durationMins ?? 40,
    },
    include: { pitch: { include: { venue: true } } },
  });

  await audit(session, {
    action: "competition.slot.add",
    summary: `Added time slot ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][slot.dayOfWeek]} ${slot.startTime} on ${slot.pitch.name}`,
    entityType: "Competition",
    entityId: competitionId,
    details: { pitchId, dayOfWeek, startTime, durationMins: slot.durationMins },
  });

  return NextResponse.json(slot, { status: 201 });
}
