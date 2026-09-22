import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// Merge a (typically pending) team nomination into an existing team.
// The nomination's contact/kit details fill in on the target where provided,
// expected players and any roster/officials move across (deduped), then the
// source team is deleted.
export async function POST(req: Request, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sourceId } = await params;
  const { targetTeamId } = await req.json();
  if (!targetTeamId) {
    return NextResponse.json({ error: "targetTeamId is required" }, { status: 400 });
  }
  if (targetTeamId === sourceId) {
    return NextResponse.json({ error: "Cannot merge a team into itself" }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.team.findUnique({
      where: { id: sourceId },
      include: { expected: true, players: true, officials: true },
    }),
    prisma.team.findUnique({
      where: { id: targetTeamId },
      include: { expected: true, players: true },
    }),
  ]);
  if (!source || !target) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Nomination details win where the coach provided them.
    await tx.team.update({
      where: { id: target.id },
      data: {
        contactName: source.contactName ?? target.contactName,
        contactEmail: source.contactEmail ?? target.contactEmail,
        contactPhone: source.contactPhone ?? target.contactPhone,
        kitShirt: source.kitShirt ?? target.kitShirt,
        kitShorts: source.kitShorts ?? target.kitShorts,
        kitSocks: source.kitSocks ?? target.kitSocks,
      },
    });

    // Move expected players across, skipping names the target already has.
    const existingNames = new Set(
      target.expected.map((e) => `${e.firstName} ${e.lastName}`.toLowerCase())
    );
    const toMove = source.expected.filter(
      (e) => !existingNames.has(`${e.firstName} ${e.lastName}`.toLowerCase())
    );
    if (toMove.length > 0) {
      await tx.expectedPlayer.createMany({
        data: toMove.map((e) => ({ teamId: target.id, firstName: e.firstName, lastName: e.lastName })),
      });
    }

    // Move any roster entries and officials that don't already exist on the target.
    const targetPlayerIds = new Set(target.players.map((p) => p.playerId));
    for (const tp of source.players) {
      if (!targetPlayerIds.has(tp.playerId)) {
        await tx.teamPlayer.create({
          data: {
            teamId: target.id,
            playerId: tp.playerId,
            jerseyNumber: tp.jerseyNumber,
            isPrimary: tp.isPrimary,
            additionalFeePaid: tp.additionalFeePaid,
          },
        });
      }
    }
    await tx.teamOfficial.updateMany({ where: { teamId: source.id }, data: { teamId: target.id } });

    // Deleting the source cascades its roster, expected list and comp link.
    await tx.team.delete({ where: { id: source.id } });
  });

  return NextResponse.json({ ok: true, targetTeamId: target.id });
}
