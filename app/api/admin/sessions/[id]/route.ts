import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  let actor;
  try {
    actor = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowed = ["title", "description", "scheduledAt", "durationMins", "capacityMax", "priceCents", "status"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === "scheduledAt" && body[key]) {
        data[key] = new Date(body[key]);
      } else if (key === "durationMins" || key === "capacityMax" || key === "priceCents") {
        data[key] = Number(body[key]);
      } else {
        data[key] = body[key];
      }
    }
  }

  const session = await prisma.futsalSession.update({
    where: { id },
    data,
    include: {
      _count: { select: { bookings: true } },
      bookings: { where: { status: "CONFIRMED" }, select: { participantCount: true } },
    },
  });

  await audit(actor, {
    action: "session.update",
    summary: `Updated session ${session.title} (${Object.keys(data).join(", ")})`,
    entityType: "FutsalSession",
    entityId: id,
    details: data,
  });

  return NextResponse.json(session);
}

export async function DELETE(_req: Request, { params }: Params) {
  let actor;
  try {
    actor = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const session = await prisma.futsalSession.delete({ where: { id } });
  await audit(actor, { action: "session.delete", summary: `Deleted session ${session.title}`, entityType: "FutsalSession", entityId: id, details: session });

  return NextResponse.json({ ok: true });
}
