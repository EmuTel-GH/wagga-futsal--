import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStandings, getTopScorers } from "@/lib/standings";

export const dynamic = "force-dynamic";

async function getData(compId?: string) {
  const competitions = await prisma.competition.findMany({
    where: { status: { in: ["ACTIVE", "FINALS", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
  });

  const activeComp = competitions.find((c) => c.id === compId) ?? competitions[0];

  if (!activeComp)
    return { competitions, activeComp: null, fixtures: [], standings: [], topScorers: [], teams: [] };

  const [fixtures, standings, topScorers, teams] = await Promise.all([
    prisma.fixture.findMany({
      where: { competitionId: activeComp.id },
      include: { homeTeam: true, awayTeam: true, pitch: { include: { venue: true } } },
      orderBy: [{ round: "asc" }, { scheduledAt: "asc" }],
    }),
    getStandings(activeComp.id),
    getTopScorers(activeComp.id),
    prisma.competitionTeam.findMany({
      where: { competitionId: activeComp.id, team: { status: "APPROVED" } },
      include: { team: { select: { id: true, name: true } } },
      orderBy: { team: { name: "asc" } },
    }),
  ]);

  return { competitions, activeComp, fixtures, standings, topScorers, teams };
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "vs",
  LIVE: "LIVE",
  COMPLETED: "FT",
  FORFEITED_HOME: "FF",
  FORFEITED_AWAY: "FF",
  ABANDONED: "ABA",
};

export default async function CompetitionPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string }>;
}) {
  const { comp } = await searchParams;
  const { competitions, activeComp, fixtures, standings, topScorers, teams } = await getData(comp);

  if (!activeComp) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-muted">No active competitions yet. Check back soon!</p>
      </div>
    );
  }

  // Group fixtures by round
  const rounds = fixtures.reduce<Record<number, typeof fixtures>>((acc, f) => {
    const key = f.round;
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-navy mb-2">Competitions</h1>

      {/* Competition tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {competitions.map((c) => (
          <Link
            key={c.id}
            href={`/competition?comp=${c.id}`}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              c.id === activeComp.id
                ? "bg-brand text-white"
                : "bg-white border border-border text-navy hover:border-brand"
            }`}
          >
            {c.name}
            {c.status === "FINALS" && <span className="ml-1 text-xs">🏆</span>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Fixtures by round */}
        <div className="lg:col-span-2 space-y-6">
          {fixtures.length === 0 && teams.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-muted uppercase mb-2">
                Teams · {activeComp.season}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {teams.map((ct) => (
                  <Link
                    key={ct.team.id}
                    href={`/teams/${ct.team.id}`}
                    className="bg-white border border-border rounded-lg px-4 py-3 font-semibold text-navy text-sm hover:border-brand hover:text-brand transition-colors"
                  >
                    {ct.team.name}
                  </Link>
                ))}
              </div>
              <p className="text-muted text-sm mt-3">
                The draw hasn&apos;t been released yet — fixtures will appear here once it is.
              </p>
            </div>
          )}
          {fixtures.length === 0 && teams.length === 0 && (
            <p className="text-muted text-sm">Team nominations for this competition are still open.</p>
          )}
          {Object.entries(rounds).map(([round, games]) => (
            <div key={round}>
              <h2 className="text-sm font-bold text-muted uppercase mb-2">Round {round}</h2>
              <div className="space-y-2">
                {games.map((f) => {
                  const isLive = f.status === "LIVE";
                  const isPlayed = ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY"].includes(f.status);
                  return (
                    <div
                      key={f.id}
                      className={`flex items-center bg-white border rounded-lg px-4 py-3 ${
                        isLive ? "border-live" : "border-border"
                      }`}
                    >
                      <Link
                        href={`/teams/${f.homeTeamId}`}
                        className="font-semibold text-navy text-sm truncate flex-1 hover:text-brand hover:underline"
                      >
                        {f.homeTeam.name}
                      </Link>

                      <Link
                        href={`/live/${f.id}`}
                        className="text-center px-4 shrink-0 hover:opacity-70"
                      >
                        {isPlayed || isLive ? (
                          <span className="font-black text-navy">
                            {f.homeScore} – {f.awayScore}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">
                            {new Date(f.scheduledAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        <p className={`text-xs font-bold mt-0.5 ${isLive ? "text-live" : "text-muted"}`}>
                          {STATUS_LABELS[f.status] ?? f.status}
                        </p>
                      </Link>

                      <Link
                        href={`/teams/${f.awayTeamId}`}
                        className="font-semibold text-navy text-sm truncate flex-1 text-right hover:text-brand hover:underline"
                      >
                        {f.awayTeam.name}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar: ladder + scorers */}
        <div className="space-y-6">
          {/* Ladder */}
          <div>
            <h2 className="text-lg font-black text-navy mb-3">Ladder</h2>
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-navy text-white">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Team</th>
                    <th className="px-2 py-2 text-center font-semibold">P</th>
                    <th className="px-2 py-2 text-center font-semibold">W</th>
                    <th className="px-2 py-2 text-center font-semibold">D</th>
                    <th className="px-2 py-2 text-center font-semibold">L</th>
                    <th className="px-2 py-2 text-center font-semibold">GD</th>
                    <th className="px-2 py-2 text-center font-semibold">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {standings.map((row, i) => (
                    <tr key={row.teamId} className={i < 4 ? "bg-brand/5" : ""}>
                      <td className="px-3 py-2 font-semibold text-navy">
                        <span className="text-muted text-xs mr-1">{i + 1}.</span>
                        <Link href={`/teams/${row.teamId}`} className="hover:text-brand hover:underline">
                          {row.teamName}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-center text-muted">{row.played}</td>
                      <td className="px-2 py-2 text-center">{row.won}</td>
                      <td className="px-2 py-2 text-center text-muted">{row.drawn}</td>
                      <td className="px-2 py-2 text-center text-muted">{row.lost}</td>
                      <td className="px-2 py-2 text-center">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                      <td className="px-2 py-2 text-center font-black text-navy">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {standings.length >= 4 && (
                <p className="text-xs text-muted px-3 py-2 border-t border-border">
                  Top 4 qualify for finals
                </p>
              )}
              {standings.length === 0 && (
                <p className="text-xs text-muted px-3 py-3">
                  The ladder appears once games are played.
                </p>
              )}
            </div>
          </div>

          {/* Top Scorers */}
          {topScorers.length > 0 && (
            <div>
              <h2 className="text-lg font-black text-navy mb-3">Top Scorers</h2>
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                {topScorers.map((s, i) => (
                  <div
                    key={s.playerId ?? i}
                    className="flex items-center justify-between px-3 py-2.5 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted text-xs w-4">{i + 1}.</span>
                      <span className="font-semibold text-sm text-navy">
                        {s.playerName ?? "Unknown"}
                        {s.jerseyNumber ? <span className="text-muted text-xs ml-1">#{s.jerseyNumber}</span> : null}
                      </span>
                    </div>
                    <span className="font-black text-brand">{s.goals}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
