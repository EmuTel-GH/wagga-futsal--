import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const competitionId = searchParams.get("competitionId");

  const fixtures = await prisma.fixture.findMany({
    where: competitionId ? { competitionId } : undefined,
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      pitch: { select: { id: true, name: true } },
      fieldReferee: { select: { id: true, firstName: true, lastName: true, user: { select: { id: true, name: true } } } }, // names only: no bank details or phone
      scorer: { select: { id: true, firstName: true, lastName: true, user: { select: { id: true, name: true } } } },
      competition: { select: { id: true, name: true, season: true } },
    },
    orderBy: [{ round: "asc" }, { scheduledAt: "asc" }],
  });

  return NextResponse.json(fixtures);
}
