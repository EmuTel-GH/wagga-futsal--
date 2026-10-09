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

// Delete a team. Unplayed (draft/scheduled) fixtures would block the delete
// (they reference the team), so: the first call explains and asks to
// confirm; ?confirm=1 removes those fixtures with the team. A team that has
// played games keeps its results — remove it from its competition instead.
const PLAYED = ["LIVE", "COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY", "ABANDONED"] as const;

export async function DELETE(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const confirmed = new URL(req.url).searchParams.get("confirm") === "1";
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const involves = { OR: [{ homeTeamId: id }, { awayTeamId: id }] };
  const [played, unplayed] = await Promise.all([
    prisma.fixture.count({ where: { ...involves, status: { in: [...PLAYED] } } }),
    prisma.fixture.findMany({ where: { ...involves, status: { in: ["DRAFT", "SCHEDULED"] } }, select: { competition: { select: { name: true } } } }),
  ]);
  if (played > 0) {
    return NextResponse.json(
      {
        error: `${team.name} has ${played} played game${played === 1 ? "" : "s"} with results, so it can't be deleted without losing them. Use "Remove from competition" to take it out of future fixtures instead.`,
      },
      { status: 409 }
    );
  }
  const comps = [...new Set(unplayed.map((f) => f.competition.name))];
  if (unplayed.length > 0 && !confirmed) {
    return NextResponse.json(
      {
        needsConfirm: true,
        error: `${team.name} is in ${unplayed.length} unplayed fixture${unplayed.length === 1 ? "" : "s"} (${comps.join(", ")}). Deleting the team removes those too, leaving gaps — regenerate that draw afterwards.`,
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.fixture.deleteMany({ where: { ...involves, status: { in: ["DRAFT", "SCHEDULED"] } } }),
    prisma.team.delete({ where: { id } }),
  ]);
  await audit(session, {
    action: "team.delete",
    summary: `Deleted team ${team.name}${unplayed.length ? ` and its ${unplayed.length} unplayed fixtures (${comps.join(", ")})` : ""}`,
    entityType: "Team",
    entityId: id,
    details: { ...team, unplayedFixturesDeleted: unplayed.length, competitions: comps },
  });

  return NextResponse.json({ ok: true, unplayedFixturesDeleted: unplayed.length });
}
