import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { applyDrawRequests, describeRequest } from "@/lib/drawRequestsDb";

type Params = { params: Promise<{ id: string }> };

// Re-order the existing draw's unplayed rounds to meet the requests.
// { dryRun: true } previews (which rounds swap weeks, what can't be met).
export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: competitionId } = await params;
  const { dryRun } = await req.json().catch(() => ({ dryRun: true }));
  const competition = await prisma.competition.findUnique({ where: { id: competitionId }, select: { name: true } });
  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  const out = await applyDrawRequests(competitionId, { dryRun: Boolean(dryRun) });
  const labelled = out.results.map((r) => ({ ...r, label: describeRequest(out.requests.find((q) => q.id === r.id)!) }));
  if (!dryRun && out.roundMoves.length) {
    await audit(session, {
      action: "competition.request.apply",
      summary: `Applied draw requests to ${competition.name}: ${out.roundMoves.length} rounds swapped weeks (${out.movedGames} games${out.publishedMoved ? `, ${out.publishedMoved} already published` : ""}); ${labelled.filter((r) => r.ok).length}/${labelled.length} requests met`,
      entityType: "Competition",
      entityId: competitionId,
      details: { roundMoves: out.roundMoves, results: labelled },
    });
  }
  return NextResponse.json({ results: labelled, roundMoves: out.roundMoves, movedGames: out.movedGames, publishedMoved: out.publishedMoved, applied: !dryRun });
}
