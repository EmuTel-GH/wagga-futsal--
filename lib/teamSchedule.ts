import { prisma } from "./prisma";
import { sydneyDateKey } from "./breakDates";

/**
 * A team's (or several teams') published schedule: every non-draft fixture,
 * plus a "bye" entry for each regular round of their competition they sit
 * out (odd-sized competitions). Feeds the team page, My Teams and the
 * calendar subscriptions, so all three always agree.
 */
export type ScheduleGame = {
  kind: "game";
  id: string;
  teamId: string; // whose schedule this entry is for
  teamName: string;
  opponentName: string;
  home: boolean;
  competition: string;
  phase: string;
  round: number;
  start: Date;
  durationMins: number;
  status: string;
  homeScore: number;
  awayScore: number;
  pitch: string | null;
  venue: string | null;
  address: string | null;
};
export type ScheduleBye = { kind: "bye"; teamId: string; teamName: string; competition: string; competitionId: string; round: number; day: string };
export type ScheduleItem = ScheduleGame | ScheduleBye;

export async function teamSchedule(teamIds: string[]): Promise<{ teams: { id: string; name: string }[]; items: ScheduleItem[] }> {
  const ids = [...new Set(teamIds)].slice(0, 10);
  const teams = await prisma.team.findMany({
    where: { id: { in: ids }, status: "APPROVED" },
    select: { id: true, name: true, competitions: { select: { competitionId: true } } },
  });
  if (!teams.length) return { teams: [], items: [] };
  const compIds = [...new Set(teams.flatMap((t) => t.competitions.map((c) => c.competitionId)))];

  const [fixtures, slots] = await Promise.all([
    prisma.fixture.findMany({
      where: {
        status: { not: "DRAFT" },
        OR: [{ homeTeamId: { in: teams.map((t) => t.id) } }, { awayTeamId: { in: teams.map((t) => t.id) } }, { competitionId: { in: compIds } }],
      },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        competition: { select: { id: true, name: true } },
        pitch: { select: { id: true, name: true, venue: { select: { name: true, address: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.competitionTimeSlot.findMany({ where: { competitionId: { in: compIds } } }),
  ]);

  // Game length: the competition's matching weekly slot, else 40 minutes.
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit" });
  const durationFor = (f: (typeof fixtures)[number]) => {
    const t = hhmm.format(f.scheduledAt);
    const own = slots.filter((s) => s.competitionId === f.competitionId);
    return (own.find((s) => s.startTime === t && s.pitchId === f.pitchId) ?? own.find((s) => s.startTime === t) ?? own[0])?.durationMins ?? 40;
  };

  const items: ScheduleItem[] = [];
  for (const team of teams) {
    for (const f of fixtures) {
      if (f.homeTeamId !== team.id && f.awayTeamId !== team.id) continue;
      const home = f.homeTeamId === team.id;
      items.push({
        kind: "game",
        id: f.id,
        teamId: team.id,
        teamName: team.name,
        opponentName: home ? f.awayTeam.name : f.homeTeam.name,
        home,
        competition: f.competition.name,
        phase: f.phase,
        round: f.round,
        start: f.scheduledAt,
        durationMins: durationFor(f),
        status: f.status,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        pitch: f.pitch?.name ?? null,
        venue: f.pitch?.venue.name ?? null,
        address: f.pitch?.venue.address ?? null,
      });
    }
    // Byes: regular rounds of the team's competition(s) it isn't playing in.
    for (const { competitionId } of team.competitions) {
      const rounds = new Map<number, (typeof fixtures)[number][]>();
      for (const f of fixtures) {
        if (f.competitionId !== competitionId || f.phase !== "REGULAR") continue;
        rounds.set(f.round, [...(rounds.get(f.round) ?? []), f]);
      }
      for (const [round, games] of rounds) {
        if (games.some((g) => g.homeTeamId === team.id || g.awayTeamId === team.id)) continue;
        items.push({ kind: "bye", teamId: team.id, teamName: team.name, competition: games[0].competition.name, competitionId, round, day: sydneyDateKey(games[0].scheduledAt) });
      }
    }
  }
  const when = (i: ScheduleItem) => (i.kind === "game" ? i.start.getTime() : new Date(`${i.day}T12:00:00+10:00`).getTime());
  items.sort((a, b) => when(a) - when(b));
  return { teams: teams.map(({ id, name }) => ({ id, name })), items };
}
