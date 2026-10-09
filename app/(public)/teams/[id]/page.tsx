import { notFound } from "next/navigation";
import Link from "next/link";
import AddToCalendar from "@/components/public/AddToCalendar";
import SaveTeamButton from "@/components/public/SaveTeamButton";
import ScheduleList from "@/components/public/ScheduleList";
import { teamSchedule } from "@/lib/teamSchedule";
import { sydneyDateKey } from "@/lib/breakDates";
import { prisma } from "@/lib/prisma";
import { getStandings } from "@/lib/standings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id } });
  return { title: team?.name ?? "Team" };
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      players: {
        include: { player: true },
        orderBy: { jerseyNumber: "asc" },
      },
      competitions: {
        include: { competition: true },
        orderBy: { competition: { createdAt: "desc" } },
      },
    },
  });

  if (!team) notFound();

  // Get recent fixtures for this team
  const recentFixtures = await prisma.fixture.findMany({
    where: {
      OR: [{ homeTeamId: id }, { awayTeamId: id }],
      status: { in: ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY"] },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      competition: true,
      events: {
        where: { type: "GOAL" },
        include: {},
      },
    },
    orderBy: { scheduledAt: "desc" },
    take: 8,
  });

  // Full schedule (games + byes) from the same source as the calendar feed.
  const today = sydneyDateKey(new Date());
  const upcoming = (await teamSchedule([id])).items.filter((i) =>
    i.kind === "bye" ? i.day >= today : sydneyDateKey(i.start) >= today && !["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY"].includes(i.status)
  );


  // Top scorers for this team across all competitions
  const teamScorers = await prisma.matchEvent.groupBy({
    by: ["playerId", "playerName", "jerseyNumber"],
    where: {
      type: "GOAL",
      teamId: id,
      playerId: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  // Current competition standing
  const activeCompetition = team.competitions.find((tc) =>
    ["ACTIVE", "FINALS"].includes(tc.competition.status)
  );
  const standings = activeCompetition
    ? await getStandings(activeCompetition.competition.id)
    : [];
  const teamStanding = standings.find((s) => s.teamId === id);
  const teamPosition = standings.findIndex((s) => s.teamId === id) + 1;

  // Form from last 5 results
  const formResults = recentFixtures.slice(0, 5).map((f) => {
    const isHome = f.homeTeamId === id;
    const myScore = isHome ? f.homeScore : f.awayScore;
    const oppScore = isHome ? f.awayScore : f.homeScore;
    if (f.status === "FORFEITED_HOME" && isHome) return "L";
    if (f.status === "FORFEITED_AWAY" && !isHome) return "L";
    if (f.status === "FORFEITED_HOME" && !isHome) return "W";
    if (f.status === "FORFEITED_AWAY" && isHome) return "W";
    if (myScore > oppScore) return "W";
    if (myScore < oppScore) return "L";
    return "D";
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/competition" className="text-brand text-sm font-semibold hover:underline mb-3 inline-block">
          ← Back to Competitions
        </Link>
        <h1 className="text-4xl font-black text-navy">{team.name}</h1>
        <div className="flex flex-wrap gap-2 mt-4">
          <SaveTeamButton team={{ id: team.id, name: team.name }} />
          <AddToCalendar feedPath={`/api/teams/${team.id}/calendar`} name={`${team.name} — Wagga Futsal`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Fixtures: everything still to come, byes included */}
          <div>
            <h2 className="text-xl font-black text-navy mb-3">Fixtures</h2>
            {upcoming.length > 0 ? (
              <ScheduleList items={upcoming} />
            ) : (
              <p className="text-sm text-muted bg-white border border-border rounded-xl p-4">
                No upcoming games published yet. Save the team or add it to your calendar and new fixtures will show up there too.
              </p>
            )}
          </div>

          {/* Recent results */}
          {recentFixtures.length > 0 && (
            <div>
              <h2 className="text-xl font-black text-navy mb-3">Recent Results</h2>
              <div className="space-y-2">
                {recentFixtures.map((f) => {
                  const isHome = f.homeTeamId === id;
                  const myScore = isHome ? f.homeScore : f.awayScore;
                  const oppScore = isHome ? f.awayScore : f.homeScore;
                  const opp = isHome ? f.awayTeam : f.homeTeam;
                  const result =
                    myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D";
                  const resultColour =
                    result === "W"
                      ? "bg-green-100 text-green-700"
                      : result === "L"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600";
                  return (
                    <Link
                      key={f.id}
                      href={`/live/${f.id}`}
                      className="flex items-center justify-between bg-white border border-border rounded-xl p-4 hover:border-brand transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span
                          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${resultColour}`}
                        >
                          {result}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-muted">{f.competition.name}</p>
                          <p className="font-semibold text-navy truncate">
                            {isHome ? "vs" : "@"} {opp.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="font-black text-xl text-navy">
                          {myScore}–{oppScore}
                        </p>
                        <p className="text-xs text-muted">
                          {new Date(f.scheduledAt).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Squad */}
          <div>
            <h2 className="text-xl font-black text-navy mb-3">
              Squad — {team.players.length} players
            </h2>
            {team.players.length === 0 ? (
              <p className="text-muted text-sm">No players registered yet.</p>
            ) : (
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-navy text-white">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold">Name</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold">Goals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {team.players.map((tp) => {
                      const scorerEntry = teamScorers.find(
                        (s) => s.playerId === tp.player.id
                      );
                      return (
                        <tr key={tp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-sm font-bold text-muted w-12">
                            {tp.jerseyNumber ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-sm font-semibold text-navy">
                            {tp.player.firstName} {tp.player.lastName}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {scorerEntry ? (
                              <span className="font-black text-brand">
                                {scorerEntry._count.id}
                              </span>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats card */}
          {teamStanding && (
            <div>
              <h2 className="text-xl font-black text-navy mb-3">Season Stats</h2>
              <div className="bg-white border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Position</span>
                  <span className="font-black text-2xl text-navy">{teamPosition}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Points</span>
                  <span className="font-black text-brand text-xl">{teamStanding.points}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
                  <div>
                    <p className="text-xs text-muted">W</p>
                    <p className="font-black text-green-600">{teamStanding.won}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">D</p>
                    <p className="font-black text-gray-500">{teamStanding.drawn}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">L</p>
                    <p className="font-black text-red-500">{teamStanding.lost}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted">Goals For / Against</span>
                  <span className="font-semibold text-sm">
                    {teamStanding.goalsFor} / {teamStanding.goalsAgainst}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Goal Difference</span>
                  <span
                    className={`font-bold text-sm ${
                      teamStanding.goalDifference >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {teamStanding.goalDifference > 0
                      ? `+${teamStanding.goalDifference}`
                      : teamStanding.goalDifference}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          {formResults.length > 0 && (
            <div>
              <h2 className="text-xl font-black text-navy mb-3">Form</h2>
              <div className="flex gap-1.5">
                {formResults.map((r, i) => (
                  <span
                    key={i}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white ${
                      r === "W"
                        ? "bg-green-500"
                        : r === "L"
                        ? "bg-red-500"
                        : "bg-gray-400"
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">Last {formResults.length} games (newest left)</p>
            </div>
          )}

          {/* Top scorers */}
          {teamScorers.length > 0 && (
            <div>
              <h2 className="text-xl font-black text-navy mb-3">Top Scorers</h2>
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                {teamScorers.slice(0, 8).map((s, i) => (
                  <div
                    key={s.playerId ?? i}
                    className="flex items-center justify-between px-3 py-2.5 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted text-xs w-4">{i + 1}.</span>
                      <span className="font-semibold text-sm text-navy">
                        {s.playerName ?? "Unknown"}
                        {s.jerseyNumber ? (
                          <span className="text-muted text-xs ml-1">#{s.jerseyNumber}</span>
                        ) : null}
                      </span>
                    </div>
                    <span className="font-black text-brand">{s._count.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitions */}
          <div>
            <h2 className="text-xl font-black text-navy mb-3">Competitions</h2>
            <div className="space-y-2">
              {team.competitions.map((tc) => (
                <Link
                  key={tc.id}
                  href={`/competition?comp=${tc.competition.id}`}
                  className="flex items-center justify-between bg-white border border-border rounded-lg px-3 py-2.5 hover:border-brand transition-colors"
                >
                  <span className="text-sm font-semibold text-navy">
                    {tc.competition.name}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      tc.competition.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : tc.competition.status === "FINALS"
                        ? "bg-brand text-white"
                        : tc.competition.status === "COMPLETED"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {tc.competition.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
