import { sydneyDateKey } from "./breakDates";

/**
 * Draw requests: "A v B on <date>" and "A has the bye on <date>".
 *
 * A round-robin round is a complete set of games, so whole rounds can be
 * played in any order without changing who plays whom or how often. A
 * request is met by swapping a round that satisfies it (the nearest one)
 * into the requested week, so each request moves at most two rounds. Played rounds never move, and dates/breaks stay as they are —
 * only which round is played in which week changes.
 */

export type PlanFixture = {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
  status: string;
};
export type PlanRequest = {
  id: string;
  kind: "MATCH_DATE" | "TEAM_BYE";
  date: string; // YYYY-MM-DD
  teamId: string;
  opponentId: string | null;
};
export type RequestResult = { id: string; ok: boolean; reason?: string };

const UNPLAYED = ["DRAFT", "SCHEDULED"];

/** Monday–Sunday (Sydney) week containing a YYYY-MM-DD day, as [mon, sun]. */
function weekOf(day: string): [string, string] {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() - dow);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}

/** Does this round satisfy the request? */
function satisfies(games: PlanFixture[], r: PlanRequest, teamIds: string[]) {
  if (r.kind === "MATCH_DATE") {
    return games.some(
      (g) => (g.homeTeamId === r.teamId && g.awayTeamId === r.opponentId) || (g.homeTeamId === r.opponentId && g.awayTeamId === r.teamId)
    );
  }
  return teamIds.includes(r.teamId) && !games.some((g) => g.homeTeamId === r.teamId || g.awayTeamId === r.teamId);
}

export function planDrawRequests(fixtures: PlanFixture[], requests: PlanRequest[], teamIds: string[]) {
  // Rounds in date order; a round with anything played/live is locked.
  const byRound = new Map<number, PlanFixture[]>();
  for (const f of fixtures) byRound.set(f.round, [...(byRound.get(f.round) ?? []), f]);
  const rounds = [...byRound.entries()]
    .map(([round, games]) => ({
      round,
      games,
      start: games.reduce((m, g) => (g.scheduledAt < m ? g.scheduledAt : m), games[0].scheduledAt),
      locked: games.some((g) => !UNPLAYED.includes(g.status)),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const open = rounds.filter((r) => !r.locked); // movable rounds = also the movable weeks, in order
  const weekDay = open.map((r) => sydneyDateKey(r.start));

  const results: RequestResult[] = [];
  // week index → requests targeting it
  const wanted = new Map<number, PlanRequest[]>();
  for (const req of requests) {
    const [mon, sun] = weekOf(req.date);
    const w = weekDay.findIndex((d) => d >= mon && d <= sun);
    if (w < 0) {
      const played = rounds.some((r) => r.locked && sydneyDateKey(r.start) >= mon && sydneyDateKey(r.start) <= sun);
      results.push({ id: req.id, ok: false, reason: played ? "that week has already been played" : "no round is scheduled that week (break, or outside the draw)" });
      continue;
    }
    wanted.set(w, [...(wanted.get(w) ?? []), req]);
  }

  // Each requested week needs one round meeting ALL of its requests.
  const weeks = [...wanted.keys()];
  const candidates = new Map<number, number[]>(); // week → open-round indices, nearest first
  for (const w of weeks) {
    const reqs = wanted.get(w)!;
    const c = open
      .map((r, i) => ({ i, ok: reqs.every((q) => satisfies(r.games, q, teamIds)) }))
      .filter((x) => x.ok)
      .map((x) => x.i)
      .sort((a, b) => Math.abs(a - w) - Math.abs(b - w));
    candidates.set(w, c);
  }
  // Bipartite matching weeks → rounds (augmenting paths; tiny sizes).
  const roundFor = new Map<number, number>(); // week → round index
  const weekFor = new Map<number, number>(); // round index → week
  const tryWeek = (w: number, seen: Set<number>): boolean => {
    for (const r of candidates.get(w)!) {
      if (seen.has(r)) continue;
      seen.add(r);
      const other = weekFor.get(r);
      if (other === undefined || tryWeek(other, seen)) {
        roundFor.set(w, r);
        weekFor.set(r, w);
        return true;
      }
    }
    return false;
  };
  for (const w of [...weeks].sort((a, b) => candidates.get(a)!.length - candidates.get(b)!.length)) tryWeek(w, new Set());

  for (const w of weeks) {
    const met = roundFor.has(w);
    for (const req of wanted.get(w)!) {
      results.push(
        met
          ? { id: req.id, ok: true }
          : {
              id: req.id,
              ok: false,
              reason: candidates.get(w)!.length
                ? "clashes with another request"
                : req.kind === "MATCH_DATE"
                  ? "that match isn't in any unplayed round"
                  : "no unplayed round gives that team the bye (even number of teams, or it's already used)",
            }
      );
    }
  }

  // Assemble by swapping: each matched round trades weeks with whatever was
  // in its target week, so a request moves at most two rounds. (A placed
  // round can't be displaced later: placed weeks hold their matched round,
  // and a not-yet-placed round never sits in a placed week.)
  const order = open.map((_, i) => i); // week → round index
  const pos = open.map((_, i) => i); // round index → week
  for (const [w, r] of roundFor) {
    const j = pos[r];
    if (j === w) continue;
    const displaced = order[w];
    order[w] = r;
    order[j] = displaced;
    pos[r] = w;
    pos[displaced] = j;
  }

  // Moves: shift each round by whole days to its new week (keeps weekday,
  // time and pitch; local-date arithmetic keeps kick-off times across DST).
  const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
  const moves: { id: string; to: Date }[] = [];
  const roundMoves: { round: number; fromDay: string; toDay: string }[] = [];
  const newStart = new Map(rounds.map((r) => [r.round, r.start.getTime()]));
  order.forEach((ri, w) => {
    const r = open[ri];
    const days = dayDiff(weekDay[ri], weekDay[w]);
    if (days === 0) return;
    roundMoves.push({ round: r.round, fromDay: weekDay[ri], toDay: weekDay[w] });
    newStart.set(r.round, r.start.getTime() + days * 86400000);
    for (const g of r.games) {
      const to = new Date(g.scheduledAt);
      to.setDate(to.getDate() + days);
      moves.push({ id: g.id, to });
    }
  });

  // Renumber every regular round by its (new) date, so "Round 5" is the 5th week.
  const renumber = new Map<number, number>(); // old round → new round
  [...newStart.entries()].sort((a, b) => a[1] - b[1]).forEach(([round], i) => renumber.set(round, i + 1));

  return { results, moves, roundMoves, renumber };
}
