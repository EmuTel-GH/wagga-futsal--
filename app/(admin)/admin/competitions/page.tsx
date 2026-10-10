import { adminPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CompetitionsClient from "./CompetitionsClient";

export const dynamic = "force-dynamic";

export default async function CompetitionsPage() {
  await adminPage(); // own check: layouts don't re-run on every navigation
  const [competitions, venues] = await Promise.all([
    prisma.competition.findMany({
      include: {
        timeSlots: { include: { pitch: { include: { venue: true } } } },
        teams: { include: { team: true } },
        _count: { select: { fixtures: true } },
        splitFrom: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.venue.findMany({
      include: { pitches: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-black text-navy mb-6">Competitions</h1>
      <CompetitionsClient initialCompetitions={competitions} venues={venues} />
    </div>
  );
}
