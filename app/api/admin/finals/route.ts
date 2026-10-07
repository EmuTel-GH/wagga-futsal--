import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getStandings } from "@/lib/standings";
import { generateFinals } from "@/lib/draw";

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { competitionId, semifinalDate, pitchId } = await req.json();

  if (!competitionId || !semifinalDate || !pitchId) {
    return NextResponse.json({ error: "competitionId, semifinalDate and pitchId required" }, { status: 400 });
  }

  const standings = await getStandings(competitionId);

  if (standings.length < 4) {
    return NextResponse.json({ error: "Need at least 4 teams in standings to generate finals" }, { status: 400 });
  }

  const finalFixtures = generateFinals(
    competitionId,
    standings,
    new Date(semifinalDate),
    pitchId
  );

  // Remove TBD grand final placeholder — created after semis are played
  const definite = finalFixtures.filter((f) => f.homeTeamId !== "TBD");

  await prisma.fixture.createMany({
    data: definite.map((f) => ({
      ...f,
      // Like the draw, finals start as drafts until an admin publishes them.
      status: "DRAFT",
    })),
  });

  await prisma.competition.update({
    where: { id: competitionId },
    data: { status: "FINALS" },
  });

  await audit(session, {
    action: "competition.finals.generate",
    summary: `Started finals: ${standings[0].teamName} v ${standings[3].teamName}, ${standings[1].teamName} v ${standings[2].teamName}`,
    entityType: "Competition",
    entityId: competitionId,
    details: { semifinalDate, pitchId, created: definite.length },
  });

  return NextResponse.json({
    created: definite.length,
    semifinals: [
      `${standings[0].teamName} vs ${standings[3].teamName}`,
      `${standings[1].teamName} vs ${standings[2].teamName}`,
    ],
  });
}
