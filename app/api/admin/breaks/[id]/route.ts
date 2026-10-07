import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { dateKey } from "@/lib/breaks";

type Params = { params: Promise<{ id: string }> };

// Remove a break. Fixtures already moved for it stay where they are.
export async function DELETE(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const removed = await prisma.fixtureBreak.delete({ where: { id }, include: { competition: { select: { name: true } } } }).catch(() => null);
  if (!removed) return NextResponse.json({ error: "Break not found" }, { status: 404 });

  await audit(session, {
    action: "break.delete",
    summary: `Removed break "${removed.name}" ${dateKey(removed.startDate)} to ${dateKey(removed.endDate)} (${removed.competition?.name ?? "all competitions"})`,
    entityType: "FixtureBreak",
    entityId: id,
    details: { name: removed.name, startDate: dateKey(removed.startDate), endDate: dateKey(removed.endDate), competitionId: removed.competitionId },
  });

  return NextResponse.json({ ok: true });
}
