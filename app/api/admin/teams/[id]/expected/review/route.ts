import { NextResponse } from "next/server";
import type { Dispensation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { flaggedExpected } from "@/lib/squadReview";
import { addPlayerToTeam, type AddPlayerResult } from "@/lib/teamPlayers";

type Params = { params: Promise<{ id: string }> };

// Authorise or reject every ineligible name on a team's expected squad in one
// go, with one shared reason. Acts only on names that are still flagged AND
// were shown to the admin (expectedIds), so a stale page can't sweep up
// someone they never saw. Each player is still recorded and audited
// individually, exactly as if done one at a time.
export async function POST(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const { action, reason, expectedIds } = await req.json();
  const why = typeof reason === "string" ? reason.trim().slice(0, 300) : "";

  if (action !== "authorise" && action !== "reject") {
    return NextResponse.json({ error: "action must be authorise or reject" }, { status: 400 });
  }
  if (!Array.isArray(expectedIds) || expectedIds.length === 0) {
    return NextResponse.json({ error: "expectedIds is required" }, { status: 400 });
  }
  if (action === "authorise") {
    if (!hasPermission(session.user, "OVERRIDE_RULES")) {
      return NextResponse.json({ error: "You don't have permission to override eligibility rules." }, { status: 403 });
    }
    if (why.length < 3) {
      return NextResponse.json({ error: "Give a reason for the override." }, { status: 400 });
    }
  }

  const [review] = await flaggedExpected([teamId]);
  if (!review) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  const targets = review.flagged.filter((f) => expectedIds.includes(f.expected.id));
  if (targets.length === 0) {
    return NextResponse.json({ error: "None of those players need review any more — refresh the page." }, { status: 409 });
  }

  const added: Extract<AddPlayerResult, { ok: true }>["teamPlayer"][] = [];
  const dispensations: Dispensation[] = [];
  const rejected: string[] = [];
  const errors: { expectedId: string; name: string; error: string }[] = [];
  const nameOf = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`.trim();

  for (const { expected, review: r } of targets) {
    if (action === "authorise") {
      const result = await addPlayerToTeam(session, { teamId, playerId: r.player.id, overrideReason: why });
      if (result.ok) {
        added.push(result.teamPlayer);
        dispensations.push(...result.dispensations);
      } else {
        errors.push({ expectedId: expected.id, name: nameOf(expected), error: result.error });
      }
    } else {
      await prisma.expectedPlayer.update({
        where: { id: expected.id },
        data: { rejectedAt: new Date(), rejectedBy: session.user.name, rejectReason: why || null },
      });
      rejected.push(expected.id);
      await audit(session, {
        action: "team.expected.reject",
        summary: `Rejected ${nameOf(expected)} from ${review.teamName}${why ? `: ${why}` : ""}`,
        entityType: "Team",
        entityId: teamId,
        details: { expectedId: expected.id, reason: why || null, bulk: true },
      });
    }
  }

  const done = action === "authorise" ? added.length : rejected.length;
  await audit(session, {
    action: action === "authorise" ? "team.expected.authorise_all" : "team.expected.reject_all",
    summary: `${action === "authorise" ? "Authorised" : "Rejected"} ${done} ineligible player${done === 1 ? "" : "s"} for ${review.teamName} in one go${why ? `: ${why}` : ""}${errors.length ? ` (${errors.length} failed)` : ""}`,
    entityType: "Team",
    entityId: teamId,
    details: {
      names: targets.map((t) => nameOf(t.expected)),
      reason: why || null,
      errors,
    },
  });

  // Rejections come back as full rows so the client can update in place.
  const rejectedRows = rejected.length
    ? await prisma.expectedPlayer.findMany({ where: { id: { in: rejected } } })
    : [];

  return NextResponse.json({ added, dispensations, rejected: rejectedRows, errors });
}
