import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Draft fixtures aren't public yet.
  const fixture = await prisma.fixture.findFirst({
    where: { id, status: { not: "DRAFT" } },
    include: {
      homeTeam: true,
      awayTeam: true,
      competition: true,
      pitch: { include: { venue: true } },
      events: { orderBy: { minute: "asc" }, include: { team: true } },
    },
  });
  if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(fixture);
}
