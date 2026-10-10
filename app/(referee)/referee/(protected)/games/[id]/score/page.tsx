import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireReferee } from "@/lib/auth";
import { callerFor } from "@/lib/callerContext";
import { canOpenScorer } from "@/lib/fixtureAccess";
import ScorerConsole from "./ScorerConsole";

export const dynamic = "force-dynamic";

export default async function ScorerPage({ params }: { params: Promise<{ id: string }> }) {
  // Checked here, not just in the layout: only signed-in users, and only the
  // game's assigned referee/scorer (or an admin) may open its console.
  let session;
  try {
    session = await requireReferee();
  } catch {
    redirect("/referee/login");
  }
  const { id } = await params;

  const fixture = await prisma.fixture.findUnique({
    where: { id },
    include: {
      homeTeam: { include: { players: { include: { player: true } } } },
      awayTeam: { include: { players: { include: { player: true } } } },
      competition: true,
      events: { orderBy: { createdAt: "desc" }, include: { team: true }, take: 20 },
    },
  });

  // Unpublished (draft) fixtures can't be scored.
  if (!fixture || fixture.status === "DRAFT" || !canOpenScorer(await callerFor(session), fixture)) notFound();

  return <ScorerConsole fixture={fixture} />;
}
