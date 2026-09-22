import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowed = ["name", "contactName", "contactEmail", "contactPhone", "kitShirt", "kitShorts", "kitSocks"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key] || null;
  }

  const team = await prisma.team.update({
    where: { id },
    data,
    include: {
      _count: { select: { players: true } },
      competitions: { include: { competition: { select: { id: true, name: true, season: true } } } },
      players: { include: { player: true } },
    },
  });

  return NextResponse.json(team);
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.team.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
