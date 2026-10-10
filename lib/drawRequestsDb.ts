import { prisma } from "./prisma";
import { dateKey, sydneyDateKey } from "./breakDates";
import { planDrawRequests, type PlanRequest } from "./drawRequests";

async function load(competitionId: string) {
  const [fixtures, teams, requests] = await Promise.all([
    prisma.fixture.findMany({
      where: { competitionId, phase: "REGULAR" },
      select: { id: true, round: true, homeTeamId: true, awayTeamId: true, scheduledAt: true, status: true },
    }),
    prisma.competitionTeam.findMany({ where: { competitionId, team: { status: "APPROVED" } }, select: { teamId: true } }),
    prisma.drawRequest.findMany({
      where: { competitionId },
      include: { team: { select: { name: true } }, opponent: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
  ]);
  const plan: PlanRequest[] = requests.map((r) => ({ id: r.id, kind: r.kind, date: dateKey(r.date), teamId: r.teamId, opponentId: r.opponentId }));
  return { fixtures, teamIds: teams.map((t) => t.teamId), requests, plan };
}

export const describeRequest = (r: { kind: string; team: { name: string }; opponent: { name: string } | null; date: Date }) =>
  `${r.kind === "MATCH_DATE" ? `${r.team.name} v ${r.opponent?.name}` : `${r.team.name} bye`} — week of ${dateKey(r.date)}`;

/**
 * Re-order the competition's unplayed rounds to meet its draw requests.
 * dryRun returns the plan only. Used after generating a draw, and by
 * "Apply requests" on an existing (draft or published) draw.
 */
export async function applyDrawRequests(competitionId: string, { dryRun }: { dryRun: boolean }) {
  const { fixtures, teamIds, requests, plan } = await load(competitionId);
  if (!requests.length || !fixtures.length) return { results: [], roundMoves: [], movedGames: 0, publishedMoved: 0, requests };
  const { results, moves, roundMoves, renumber } = planDrawRequests(fixtures, plan, teamIds);
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  const publishedMoved = moves.filter((m) => byId.get(m.id)!.status === "SCHEDULED").length;
  if (!dryRun && (moves.length || [...renumber].some(([a, b]) => a !== b))) {
    const moveTo = new Map(moves.map((m) => [m.id, m.to]));
    await prisma.$transaction(
      fixtures
        .filter((f) => moveTo.has(f.id) || renumber.get(f.round) !== f.round)
        .map((f) => prisma.fixture.update({ where: { id: f.id }, data: { scheduledAt: moveTo.get(f.id) ?? f.scheduledAt, round: renumber.get(f.round) ?? f.round } }))
    );
  }
  return { results, roundMoves, movedGames: moves.length, publishedMoved, requests };
}

/** Is each request met by the draw as it stands right now? */
export async function requestStatus(competitionId: string) {
  const { fixtures, teamIds, requests } = await load(competitionId);
  return requests.map((r) => {
    const target = dateKey(r.date);
    const d = new Date(`${target}T12:00:00Z`);
    const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
    const [lo, hi] = [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
    const week = fixtures.filter((f) => {
      const k = sydneyDateKey(f.scheduledAt);
      return k >= lo && k <= hi;
    });
    let met: boolean | null = null; // null = no draw that week yet
    if (week.length) {
      met = r.kind === "MATCH_DATE"
        ? week.some((f) => [f.homeTeamId, f.awayTeamId].sort().join() === [r.teamId, r.opponentId].sort().join())
        : teamIds.includes(r.teamId) && !week.some((f) => f.homeTeamId === r.teamId || f.awayTeamId === r.teamId);
    }
    return {
      id: r.id,
      kind: r.kind,
      date: target,
      teamId: r.teamId,
      teamName: r.team.name,
      opponentId: r.opponentId,
      opponentName: r.opponent?.name ?? null,
      note: r.note,
      met,
    };
  });
}
