import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// Assign a registered coach/manager to this team (rules 1.3–1.4: every team
// needs an over-18 registered official).
export async function POST(req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { officialId } = await req.json();
  if (!officialId) {
    return NextResponse.json({ error: "officialId is required" }, { status: 400 });
  }

  const official = await prisma.teamOfficial.update({
    where: { id: officialId },
    data: { teamId },
  });

  return NextResponse.json(official, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { searchParams } = new URL(req.url);
  const officialId = searchParams.get("officialId");
  if (!officialId) {
    return NextResponse.json({ error: "officialId query param required" }, { status: 400 });
  }

  await prisma.teamOfficial.updateMany({
    where: { id: officialId, teamId },
    data: { teamId: null },
  });

  return NextResponse.json({ ok: true });
}
