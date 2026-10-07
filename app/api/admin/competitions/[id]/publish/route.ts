import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// Publish a competition's draft fixtures: DRAFT → SCHEDULED, which puts them
// on the public site, the public API and the referee portal.
export async function POST(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: competitionId } = await params;
  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  const { count } = await prisma.fixture.updateMany({
    where: { competitionId, status: "DRAFT" },
    data: { status: "SCHEDULED" },
  });
  if (count === 0) {
    return NextResponse.json({ error: "There are no draft fixtures to publish." }, { status: 409 });
  }
  if (competition.status === "REGISTRATION") {
    await prisma.competition.update({ where: { id: competitionId }, data: { status: "ACTIVE" } });
  }

  await audit(session, {
    action: "competition.draw.publish",
    summary: `Published ${count} draft fixture${count === 1 ? "" : "s"} for ${competition.name}`,
    entityType: "Competition",
    entityId: competitionId,
    details: { published: count },
  });

  return NextResponse.json({ published: count });
}
