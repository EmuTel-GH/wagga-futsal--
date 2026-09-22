import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getStandings, getTopScorers } from "@/lib/standings";
import TeamSearch from "@/components/public/TeamSearch";

export const dynamic = "force-dynamic";

async function getHomepageData() {
  const [upcomingFixtures, liveFixtures, recentResults, competitions, sponsors, topCompetition] =
    await Promise.all([
      prisma.fixture.findMany({
        where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
        include: {
          homeTeam: true,
          awayTeam: true,
          competition: true,
          pitch: { include: { venue: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      }),
      prisma.fixture.findMany({
        where: { status: "LIVE" },
        include: {
          homeTeam: true,
          awayTeam: true,
          competition: true,
          pitch: { include: { venue: true } },
          events: { orderBy: { createdAt: "desc" }, take: 5, include: { team: true } },
        },
      }),
      prisma.fixture.findMany({
        where: { status: { in: ["COMPLETED", "FORFEITED_HOME", "FORFEITED_AWAY"] } },
        include: { homeTeam: true, awayTeam: true, competition: true },
        orderBy: { scheduledAt: "desc" },
        take: 5,
      }),
      prisma.competition.findMany({
        where: { status: { in: ["ACTIVE", "FINALS"] } },
        take: 6,
      }),
      prisma.sponsor.findMany({
        where: { active: true },
        orderBy: [{ tier: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.competition.findFirst({
        where: { status: { in: ["ACTIVE", "FINALS"] } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const [standings, topScorers] = topCompetition
    ? await Promise.all([
        getStandings(topCompetition.id),
        getTopScorers(topCompetition.id, 5),
      ])
    : [[], []];

  return {
    upcomingFixtures,
    liveFixtures,
    recentResults,
    competitions,
    sponsors,
    topCompetition,
    standings,
    topScorers,
  };
}

const EVENT_ICONS: Record<string, string> = {
  GOAL: "⚽",
  YELLOW_CARD: "🟨",
  RED_CARD: "🟥",
  FOUL: "🚫",
};

export default async function HomePage() {
  const {
    upcomingFixtures,
    liveFixtures,
    recentResults,
    competitions,
    sponsors,
    topCompetition,
    standings,
    topScorers,
  } = await getHomepageData();

  return (
    <>
      {/* Hero */}
      <section className="bg-navy text-white py-16 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 text-center md:text-left">
            <p className="text-brand font-semibold text-sm uppercase tracking-widest mb-3">
              Est. 2012 · Wagga Wagga, NSW
            </p>
            <h1 className="text-5xl md:text-6xl font-black mb-4">
              WAGGA <span className="text-brand">FUTSAL</span>
            </h1>
            <p className="text-white font-bold text-xl mb-2">You Are Your Only Limit!</p>
            <p className="text-white/70 text-lg mb-8 max-w-xl">
              High speed, high energy, high skill — indoor futsal for all ages, from Under 8s to
              Opens. Summer 2026 registration is open now.
            </p>
            <div className="mb-6 flex justify-center md:justify-start">
              <TeamSearch placeholder="Find your team — search and pin it here…" />
            </div>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <Link
                href="/register"
                className="bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3 rounded-lg transition-colors"
              >
                Register for Summer 2026
              </Link>
              <Link
                href="/competition"
                className="border border-white/30 hover:border-brand text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                View Draws & Ladders
              </Link>
              <Link
                href="/sessions"
                className="border border-brand text-brand hover:bg-brand hover:text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Book a Session
              </Link>
            </div>
          </div>
          <div className="shrink-0">
            <Image
              src="/logo.png"
              alt="Wagga Futsal"
              width={200}
              height={200}
              className="drop-shadow-2xl"
              priority
            />
          </div>
        </div>
      </section>

      {/* Summer 2026 season banner */}
      <section className="bg-brand text-white px-4 py-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-black text-lg leading-tight">Summer 2026 kicks off 14–15 October</p>
            <p className="text-white/85 text-sm">
              Wed: U10 · U16 · Opens &nbsp;|&nbsp; Thu: U12 · U14 &nbsp;·&nbsp; $215 juniors / $230
              seniors
            </p>
          </div>
          <Link
            href="/register"
            className="shrink-0 bg-white text-brand font-bold px-5 py-2.5 rounded-lg hover:bg-navy hover:text-white transition-colors text-sm"
          >
            Season details & registration →
          </Link>
        </div>
      </section>

      {/* Live games */}
      {liveFixtures.length > 0 && (
        <section className="bg-live px-4 py-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-white font-black text-sm uppercase tracking-widest">
                Live Now
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {liveFixtures.map((f) => (
                <Link
                  key={f.id}
                  href={`/live/${f.id}`}
                  className="bg-white/10 hover:bg-white/20 rounded-2xl p-4 transition-colors"
                >
                  <p className="text-white/70 text-xs mb-3">
                    {f.competition.name} · {f.pitch?.venue.name}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-sm flex-1 truncate">
                      {f.homeTeam.name}
                    </span>
                    <span className="font-black text-white text-3xl shrink-0">
                      {f.homeScore}–{f.awayScore}
                    </span>
                    <span className="font-bold text-white text-sm flex-1 truncate text-right">
                      {f.awayTeam.name}
                    </span>
                  </div>
                  {f.events.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/20 space-y-1">
                      {f.events.slice(0, 3).map((e) => (
                        <p key={e.id} className="text-white/80 text-xs">
                          {EVENT_ICONS[e.type] ?? "•"} {e.minute}&apos; —{" "}
                          {e.playerName ?? e.team.name}
                        </p>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: fixtures + recent results */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h2 className="text-2xl font-black text-navy mb-4">Upcoming Fixtures</h2>
            {upcomingFixtures.length === 0 ? (
              <p className="text-muted">No upcoming fixtures scheduled.</p>
            ) : (
              <div className="space-y-2">
                {upcomingFixtures.map((f) => (
                  <Link
                    key={f.id}
                    href="/competition"
                    className="flex items-center justify-between bg-white border border-border rounded-xl p-4 hover:border-brand transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted mb-1">
                        {f.competition.name} · {f.pitch?.venue.name ?? "TBC"}
                      </p>
                      <div className="flex items-center gap-2 font-semibold text-navy">
                        <span className="truncate">{f.homeTeam.name}</span>
                        <span className="text-muted text-sm shrink-0">vs</span>
                        <span className="truncate">{f.awayTeam.name}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-semibold text-navy">
                        {new Date(f.scheduledAt).toLocaleDateString("en-AU", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p className="text-xs text-muted">
                        {new Date(f.scheduledAt).toLocaleTimeString("en-AU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link
              href="/competition"
              className="inline-block mt-3 text-brand font-semibold hover:underline text-sm"
            >
              View full draw →
            </Link>
          </div>

          {recentResults.length > 0 && (
            <div>
              <h2 className="text-2xl font-black text-navy mb-4">Recent Results</h2>
              <div className="space-y-2">
                {recentResults.map((f) => (
                  <Link
                    key={f.id}
                    href={`/live/${f.id}`}
                    className="flex items-center justify-between bg-white border border-border rounded-xl p-4 hover:border-brand transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted mb-1">{f.competition.name}</p>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-navy truncate flex-1">
                          {f.homeTeam.name}
                        </span>
                        <span className="font-black text-navy shrink-0 text-xl">
                          {f.homeScore}–{f.awayScore}
                        </span>
                        <span className="font-semibold text-navy truncate flex-1 text-right">
                          {f.awayTeam.name}
                        </span>
                      </div>
                    </div>
                    <span className="ml-4 shrink-0 text-xs font-bold text-muted border border-border rounded px-1.5 py-0.5">
                      FT
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: ladder + top scorers + competitions */}
        <div className="space-y-6">
          {topCompetition && standings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-black text-navy">Ladder</h2>
                <Link
                  href={`/competition?comp=${topCompetition.id}`}
                  className="text-xs text-brand font-semibold hover:underline"
                >
                  {topCompetition.name}
                </Link>
              </div>
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-navy text-white">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Team</th>
                      <th className="px-2 py-2 text-center font-semibold text-xs">P</th>
                      <th className="px-2 py-2 text-center font-semibold text-xs">W</th>
                      <th className="px-2 py-2 text-center font-semibold text-xs">GD</th>
                      <th className="px-2 py-2 text-center font-semibold text-xs">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {standings.slice(0, 6).map((row, i) => (
                      <tr key={row.teamId} className={i < 4 ? "bg-brand/5" : ""}>
                        <td className="px-3 py-2 font-semibold text-navy text-xs">
                          <span className="text-muted mr-1">{i + 1}.</span>
                          {row.teamName}
                        </td>
                        <td className="px-2 py-2 text-center text-muted text-xs">{row.played}</td>
                        <td className="px-2 py-2 text-center text-xs">{row.won}</td>
                        <td className="px-2 py-2 text-center text-xs">
                          {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                        </td>
                        <td className="px-2 py-2 text-center font-black text-navy text-xs">
                          {row.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {standings.length >= 4 && (
                  <p className="text-xs text-muted px-3 py-2 border-t border-border">
                    Top 4 qualify for finals
                  </p>
                )}
              </div>
              <Link
                href={`/competition?comp=${topCompetition.id}`}
                className="inline-block mt-2 text-brand text-xs font-semibold hover:underline"
              >
                Full ladder & draw →
              </Link>
            </div>
          )}

          {topScorers.length > 0 && (
            <div>
              <h2 className="text-xl font-black text-navy mb-3">Top Scorers</h2>
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
                        {s.jerseyNumber ? (
                          <span className="text-muted text-xs ml-1">#{s.jerseyNumber}</span>
                        ) : null}
                      </span>
                    </div>
                    <span className="font-black text-brand">{s.goals}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {competitions.length > 0 && (
            <div>
              <h2 className="text-xl font-black text-navy mb-3">Competitions</h2>
              <div className="space-y-2">
                {competitions.map((c) => (
                  <Link
                    key={c.id}
                    href={`/competition?comp=${c.id}`}
                    className="flex items-center justify-between bg-white border border-border rounded-lg px-4 py-3 hover:border-brand transition-colors"
                  >
                    <span className="font-semibold text-navy text-sm">{c.name}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        c.status === "FINALS" ? "bg-brand text-white" : "bg-navy/10 text-navy"
                      }`}
                    >
                      {c.status === "FINALS" ? "FINALS" : "Active"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sponsors */}
      {sponsors.length > 0 && (
        <section className="border-t border-border py-10 px-4">
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-xs uppercase tracking-widest text-muted mb-6">
              Our Sponsors
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8">
              {sponsors.map((s) => (
                <a
                  key={s.id}
                  href={s.website ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  title={s.name}
                >
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.name} className="h-10 object-contain" />
                  ) : (
                    <span className="text-navy font-bold text-sm">{s.name}</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
