import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Add a break (no games): { name, startDate, endDate, competitionId? }.
// Dates are inclusive YYYY-MM-DD; no competitionId = every competition.
export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, startDate, endDate, competitionId } = await req.json();
  const label = String(name ?? "").trim().slice(0, 80);
  if (!label || !DAY.test(String(startDate)) || !DAY.test(String(endDate))) {
    return NextResponse.json({ error: "Name, start date and end date are required" }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "The end date is before the start date" }, { status: 400 });
  }
  const competition = competitionId
    ? await prisma.competition.findUnique({ where: { id: competitionId }, select: { id: true, name: true } })
    : null;
  if (competitionId && !competition) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  const created = await prisma.fixtureBreak.create({
    data: {
      name: label,
      startDate: new Date(`${startDate}T00:00:00Z`),
      endDate: new Date(`${endDate}T00:00:00Z`),
      competitionId: competition?.id ?? null,
    },
    include: { competition: { select: { id: true, name: true } } },
  });

  await audit(session, {
    action: "break.create",
    summary: `Added break "${label}" ${startDate} to ${endDate} for ${competition?.name ?? "all competitions"}`,
    entityType: "FixtureBreak",
    entityId: created.id,
    details: { name: label, startDate, endDate, competitionId: competition?.id ?? null },
  });

  return NextResponse.json(created, { status: 201 });
}
