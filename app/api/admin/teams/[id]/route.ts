import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { flaggedExpected } from "@/lib/squadReview";

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

  const allowed = ["name", "contactName", "contactEmail", "contactPhone", "kitShirt", "kitShorts", "kitSocks"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key] || null;
  }
  // Approve (or re-pend) a nominated team.
  if ("status" in body && ["PENDING", "APPROVED"].includes(body.status)) {
    data.status = body.status;
  }

  // A nomination can't be approved while it lists players who are ineligible
  // for its competition and nobody has authorised or rejected them yet.
  if (data.status === "APPROVED") {
    const [review] = await flaggedExpected([id]);
    if (review && review.flagged.length > 0) {
      const names = review.flagged.map((f) => `${f.expected.firstName} ${f.expected.lastName}`.trim()).join(", ");
      return NextResponse.json(
        { error: `Authorise or reject the ineligible players first: ${names}.` },
        { status: 409 }
      );
    }
  }

  const team = await prisma.team.update({
    where: { id },
    data,
    include: {
      _count: { select: { players: true } },
      competitions: { include: { competition: { select: { id: true, name: true, season: true, ageGroup: true, gender: true } } } },
      players: { include: { player: true } },
    },
  });

  await audit(session, {
    action: data.status === "APPROVED" ? "team.approve" : "team.update",
    summary:
      data.status === "APPROVED"
        ? `Approved team nomination ${team.name}`
        : `Updated team ${team.name} (${Object.keys(data).join(", ")})`,
    entityType: "Team",
    entityId: id,
    details: data,
  });

  return NextResponse.json(team);
}

export async function DELETE(_req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const team = await prisma.team.delete({ where: { id } });
  await audit(session, { action: "team.delete", summary: `Deleted team ${team.name}`, entityType: "Team", entityId: id, details: team });

  return NextResponse.json({ ok: true });
}
