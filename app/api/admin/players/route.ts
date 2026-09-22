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
  const q = searchParams.get("q") ?? "";
  const unassigned = searchParams.get("unassigned") === "1";

  const players = await prisma.player.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      // "Free agents" are simply players without a team yet — every player
      // must be mapped to a team by competition start.
      ...(unassigned ? { teamPlayers: { none: {} } } : {}),
    },
    include: {
      teamPlayers: { select: { isPrimary: true, team: { select: { name: true } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 300,
  });

  return NextResponse.json(players);
}
