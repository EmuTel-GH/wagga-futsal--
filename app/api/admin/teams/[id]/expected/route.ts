import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// Replace the team's EXPECTED squad — the player names off the team
// registration form. One name per line ("First Last"); these are matched
// against actual PlayFootball registrations in the admin UI.
export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { names } = await req.json();
  if (typeof names !== "string") {
    return NextResponse.json({ error: "names (multiline string) is required" }, { status: 400 });
  }

  const parsed = names
    .split("\n")
    .map((l) => l.replace(/^\s*\d+[.)]?\s*/, "").trim()) // tolerate "1. Name" numbering
    .filter(Boolean)
    .map((full) => {
      const parts = full.split(/\s+/);
      return parts.length === 1
        ? { firstName: parts[0], lastName: "" }
        : { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
    });

  const expected = await prisma.$transaction(async (tx) => {
    // Keep earlier rejections for names that are still on the list.
    const key = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim().toLowerCase();
    const rejected = new Map(
      (await tx.expectedPlayer.findMany({ where: { teamId, rejectedAt: { not: null } } })).map((e) => [key(e), e])
    );
    await tx.expectedPlayer.deleteMany({ where: { teamId } });
    await tx.expectedPlayer.createMany({
      data: parsed.map((p) => {
        const r = rejected.get(key(p));
        return { ...p, teamId, rejectedAt: r?.rejectedAt ?? null, rejectedBy: r?.rejectedBy ?? null, rejectReason: r?.rejectReason ?? null };
      }),
    });
    return tx.expectedPlayer.findMany({ where: { teamId }, orderBy: { createdAt: "asc" } });
  });

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
  await audit(session, {
    action: "team.expected.replace",
    summary: `Replaced the expected squad for ${team?.name ?? "team"} (${parsed.length} names)`,
    entityType: "Team",
    entityId: teamId,
    details: { names: parsed.map((p) => `${p.firstName} ${p.lastName}`.trim()) },
  });

  return NextResponse.json(expected, { status: 201 });
}

// Reject (or un-reject) one name on the expected squad — used when a nominated
// player is ineligible and the administrators decide not to authorise them.
export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { expectedId, rejected, reason } = await req.json();
  if (!expectedId || typeof rejected !== "boolean") {
    return NextResponse.json({ error: "expectedId and rejected (boolean) are required" }, { status: 400 });
  }

  const existing = await prisma.expectedPlayer.findFirst({
    where: { id: expectedId, teamId },
    include: { team: { select: { name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Expected player not found" }, { status: 404 });

  const expected = await prisma.expectedPlayer.update({
    where: { id: expectedId },
    data: rejected
      ? { rejectedAt: new Date(), rejectedBy: session.user.name, rejectReason: reason ? String(reason).trim().slice(0, 300) : null }
      : { rejectedAt: null, rejectedBy: null, rejectReason: null },
  });

  const name = `${existing.firstName} ${existing.lastName}`.trim();
  await audit(session, {
    action: rejected ? "team.expected.reject" : "team.expected.unreject",
    summary: rejected
      ? `Rejected ${name} from ${existing.team.name}${expected.rejectReason ? `: ${expected.rejectReason}` : ""}`
      : `Undid the rejection of ${name} from ${existing.team.name}`,
    entityType: "Team",
    entityId: teamId,
    details: { expectedId, reason: expected.rejectReason },
  });

  return NextResponse.json(expected);
}
