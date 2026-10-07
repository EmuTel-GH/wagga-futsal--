import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { breaksForCompetition, planBreakShifts, sydneyDateKey } from "@/lib/breaks";

type Params = { params: Promise<{ id: string }> };

// Move a competition's unplayed fixtures (draft or published) out of breaks.
// { dryRun: true } returns the plan without changing anything, for the
// confirm step. Rounds keep their weekday, time and pitch; see planBreakShifts.
export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: competitionId } = await params;
  const { dryRun } = await req.json().catch(() => ({ dryRun: true }));
  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  const [fixtures, breaks] = await Promise.all([
    prisma.fixture.findMany({
      where: { competitionId, status: { in: ["DRAFT", "SCHEDULED"] } },
      select: { id: true, round: true, phase: true, scheduledAt: true, status: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    }),
    breaksForCompetition(competitionId),
  ]);
  const { moved, weeksAdded } = planBreakShifts(fixtures, breaks);
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  const changes = moved.map((m) => {
    const f = byId.get(m.id)!;
    return {
      id: m.id,
      match: `${f.homeTeam.name} v ${f.awayTeam.name}`,
      round: f.round,
      published: f.status === "SCHEDULED",
      from: m.from.toISOString(),
      to: m.to.toISOString(),
      breakName: m.breakName,
    };
  });

  if (dryRun || changes.length === 0) {
    return NextResponse.json({ changes, weeksAdded, applied: false });
  }

  await prisma.$transaction(moved.map((m) => prisma.fixture.update({ where: { id: m.id }, data: { scheduledAt: m.to } })));

  const published = changes.filter((c) => c.published).length;
  await audit(session, {
    action: "competition.breaks.shift",
    summary: `Moved ${changes.length} fixture${changes.length === 1 ? "" : "s"} in ${competition.name} out of breaks (season ${weeksAdded} week${weeksAdded === 1 ? "" : "s"} longer${published ? `, ${published} already published` : ""})`,
    entityType: "Competition",
    entityId: competitionId,
    details: {
      weeksAdded,
      breaks: [...new Set(changes.map((c) => c.breakName).filter(Boolean))],
      moved: changes.map((c) => ({ id: c.id, match: c.match, from: sydneyDateKey(new Date(c.from)), to: sydneyDateKey(new Date(c.to)) })),
    },
  });

  return NextResponse.json({ changes, weeksAdded, applied: true });
}
