import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { requestStatus } from "@/lib/drawRequestsDb";

type Params = { params: Promise<{ id: string }> };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Draw requests for a competition, each with whether the current draw meets it.
export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  return NextResponse.json(await requestStatus(id));
}

// Add one: { kind: "MATCH_DATE", teamId, opponentId, date } or { kind: "TEAM_BYE", teamId, date }.
export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: competitionId } = await params;
  const { kind, teamId, opponentId, date, note } = await req.json();
  if (!["MATCH_DATE", "TEAM_BYE"].includes(kind) || !teamId || !DAY.test(String(date))) {
    return NextResponse.json({ error: "Choose the type, team(s) and date" }, { status: 400 });
  }
  if (kind === "MATCH_DATE" && (!opponentId || opponentId === teamId)) {
    return NextResponse.json({ error: "Choose two different teams" }, { status: 400 });
  }
  const inComp = await prisma.competitionTeam.findMany({
    where: { competitionId, teamId: { in: [teamId, opponentId].filter(Boolean) } },
    include: { team: { select: { name: true } }, competition: { select: { name: true } } },
  });
  if (inComp.length !== (kind === "MATCH_DATE" ? 2 : 1)) {
    return NextResponse.json({ error: "Both teams must be in this competition" }, { status: 400 });
  }
  const created = await prisma.drawRequest.create({
    data: {
      competitionId,
      kind,
      teamId,
      opponentId: kind === "MATCH_DATE" ? opponentId : null,
      date: new Date(`${date}T00:00:00Z`),
      note: note ? String(note).trim().slice(0, 200) : null,
    },
  });
  const name = (t: string) => inComp.find((c) => c.teamId === t)!.team.name;
  await audit(session, {
    action: "competition.request.create",
    summary: `Draw request for ${inComp[0].competition.name}: ${kind === "MATCH_DATE" ? `${name(teamId)} v ${name(opponentId)}` : `${name(teamId)} has the bye`} in the week of ${date}`,
    entityType: "Competition",
    entityId: competitionId,
    details: { requestId: created.id, kind, teamId, opponentId, date, note },
  });
  return NextResponse.json(created, { status: 201 });
}

// Remove one: ?requestId=…
export async function DELETE(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: competitionId } = await params;
  const requestId = new URL(req.url).searchParams.get("requestId");
  const r = requestId
    ? await prisma.drawRequest.findFirst({
        where: { id: requestId, competitionId },
        include: { team: { select: { name: true } }, opponent: { select: { name: true } } },
      })
    : null;
  if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  await prisma.drawRequest.delete({ where: { id: r.id } });
  await audit(session, {
    action: "competition.request.delete",
    summary: `Removed draw request: ${r.kind === "MATCH_DATE" ? `${r.team.name} v ${r.opponent?.name}` : `${r.team.name} bye`} (week of ${r.date.toISOString().slice(0, 10)})`,
    entityType: "Competition",
    entityId: competitionId,
    details: { requestId: r.id },
  });
  return NextResponse.json({ ok: true });
}
