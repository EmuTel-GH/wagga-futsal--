import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { maybeCreateGrandFinal } from "@/lib/finals";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowed = ["scheduledAt", "pitchId", "fieldRefereeId", "scorerId", "status", "homeScore", "awayScore", "notes"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === "scheduledAt" && body[key]) {
        data[key] = new Date(body[key]);
      } else {
        data[key] = body[key] === "" ? null : body[key];
      }
    }
  }

  const fixture = await prisma.fixture.update({
    where: { id },
    data,
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      pitch: { select: { id: true, name: true } },
      fieldReferee: { include: { user: { select: { id: true, name: true } } } },
      scorer: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  await audit(session, {
    action: "fixture.update",
    summary: `Updated fixture ${fixture.homeTeam.name} v ${fixture.awayTeam.name} (${Object.keys(data).join(", ")})`,
    entityType: "Fixture",
    entityId: id,
    details: data,
  });


  // Both semis decided? Create the planned grand final.
  if (fixture.phase === "SEMI_FINAL") {
    const gf = await maybeCreateGrandFinal(fixture.competitionId);
    if (gf) {
      await audit(session, {
        action: "competition.finals.grand_final",
        summary: `Grand final set: ${gf.homeTeam.name} v ${gf.awayTeam.name}`,
        entityType: "Fixture",
        entityId: gf.id,
        details: { competitionId: fixture.competitionId, automatic: true },
      });
    }
  }

  return NextResponse.json(fixture);
}
