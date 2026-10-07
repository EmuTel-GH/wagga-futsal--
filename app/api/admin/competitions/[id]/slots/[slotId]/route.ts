import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string; slotId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: competitionId, slotId } = await params;

  const slot = await prisma.competitionTimeSlot.delete({ where: { id: slotId }, include: { pitch: { select: { name: true } } } });
  await audit(session, {
    action: "competition.slot.remove",
    summary: `Removed time slot ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][slot.dayOfWeek]} ${slot.startTime} on ${slot.pitch.name}`,
    entityType: "Competition",
    entityId: competitionId,
    details: slot,
  });

  return NextResponse.json({ ok: true });
}
