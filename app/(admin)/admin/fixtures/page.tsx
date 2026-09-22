import { prisma } from "@/lib/prisma";
import FixturesClient from "./FixturesClient";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ comp?: string }> };

export default async function FixturesPage({ searchParams }: Props) {
  const { comp } = await searchParams;

  const [fixtures, referees, pitches, competitions] = await Promise.all([
    prisma.fixture.findMany({
      where: comp ? { competitionId: comp } : undefined,
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        pitch: { select: { id: true, name: true } },
        fieldReferee: { include: { user: { select: { id: true, name: true } } } },
        scorer: { include: { user: { select: { id: true, name: true } } } },
        competition: { select: { id: true, name: true, season: true } },
      },
      orderBy: [{ round: "asc" }, { scheduledAt: "asc" }],
    }),
    prisma.referee.findMany({
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.pitch.findMany({
      include: { venue: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.competition.findMany({
      select: { id: true, name: true, season: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Referees imported from PlayFootball may have no linked login (user = null);
  // present a display name either way so the client components stay simple.
  const refName = (r: { user: { name: string } | null; firstName: string | null; lastName: string | null }) =>
    r.user?.name ?? [r.firstName, r.lastName].filter(Boolean).join(" ") ?? "Unnamed referee";
  const refereesForClient = referees.map((r) => ({ id: r.id, user: { id: r.user?.id ?? r.id, name: refName(r) } }));
  const fixturesForClient = fixtures.map((f) => ({
    ...f,
    fieldReferee: f.fieldReferee ? { id: f.fieldReferee.id, user: { id: f.fieldReferee.id, name: refName(f.fieldReferee) } } : null,
    scorer: f.scorer ? { id: f.scorer.id, user: { id: f.scorer.id, name: refName(f.scorer) } } : null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-black text-navy mb-6">Fixtures</h1>
      <FixturesClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialFixtures={fixturesForClient as any}
        referees={refereesForClient}
        pitches={pitches}
        competitions={competitions}
        selectedCompId={comp ?? ""}
      />
    </div>
  );
}
