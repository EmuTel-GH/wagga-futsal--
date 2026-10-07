import { breakFor, type BreakRange } from "./breakDates";

interface DrawTeam {
  id: string;
}

interface DrawSlot {
  pitchId: string;
  dayOfWeek: number;
  startTime: string;
  durationMins: number;
}

interface Fixture {
  homeTeamId: string;
  awayTeamId: string;
  round: number;
  pitchId: string;
  scheduledAt: Date;
}

// Generate a round-robin schedule (Berger tables algorithm).
// `cycles` = how many times each pair meets: season default is 2 (teams play
// each other twice); Opens plays 3. Home/away alternates between cycles.
export function generateRoundRobin(teams: DrawTeam[], cycles = 2): Array<[string, string][]> {
  const list = [...teams];
  const hasBye = list.length % 2 !== 0;
  if (hasBye) list.push({ id: "BYE" });

  const n = list.length;
  const single: Array<[string, string][]> = [];

  for (let round = 0; round < n - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (home.id !== "BYE" && away.id !== "BYE") {
        pairs.push([home.id, away.id]);
      }
    }
    single.push(pairs);

    // rotate all but first element
    const last = list.splice(n - 1, 1)[0];
    list.splice(1, 0, last);
  }

  const rounds: Array<[string, string][]> = [];
  for (let c = 0; c < cycles; c++) {
    for (const pairs of single) {
      // Flip home/away on every second cycle so venues/kick-offs balance out.
      rounds.push(c % 2 === 1 ? pairs.map(([h, a]): [string, string] => [a, h]) : pairs);
    }
  }

  return rounds;
}

// Given rounds and available time slots, produce scheduled fixtures.
// Rounds go out one per week from startDate. A round is placed as a whole: if
// any of its games would land in a break (holiday, Christmas...) the entire
// round moves to the next week, so a round is never split across a break.
export function scheduleFixtures(
  competitionId: string,
  rounds: Array<[string, string][]>,
  slots: DrawSlot[],
  startDate: Date,
  breaks: BreakRange[] = []
): { fixtures: Fixture[]; skipped: { date: Date; breakName: string }[] } {
  const fixtures: Fixture[] = [];
  const skipped: { date: Date; breakName: string }[] = [];
  let slotIndex = 0;
  let currentDate = new Date(startDate);

  // Advance to the first matching day of week
  const advanceToDay = (date: Date, targetDay: number): Date => {
    const d = new Date(date);
    while (d.getDay() !== targetDay) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  };

  // Where each game of a round would go if the round started this week.
  const plan = (pairs: [string, string][], from: Date) =>
    pairs.map((pair, i) => {
      const slot = slots[(slotIndex + i) % slots.length];
      const gameDate = advanceToDay(new Date(from), slot.dayOfWeek);
      const [hour, minute] = slot.startTime.split(":").map(Number);
      gameDate.setHours(hour, minute, 0, 0);
      return { pair, slot, gameDate };
    });

  for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
    const pairs = rounds[roundIdx];
    if (pairs.length === 0) continue;

    let games = plan(pairs, currentDate);
    for (let guard = 0; guard < 104; guard++) {
      const hit = games.map((g) => breakFor(g.gameDate, breaks)).find(Boolean);
      if (!hit) break;
      skipped.push({ date: games[0].gameDate, breakName: hit.name });
      currentDate.setDate(currentDate.getDate() + 7);
      games = plan(pairs, currentDate);
    }

    for (const { pair, slot, gameDate } of games) {
      fixtures.push({
        homeTeamId: pair[0],
        awayTeamId: pair[1],
        round: roundIdx + 1,
        pitchId: slot.pitchId,
        scheduledAt: gameDate,
      });
    }
    slotIndex += pairs.length;

    // Next round: a week after this round's last game.
    currentDate = new Date(games[games.length - 1].gameDate);
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return { fixtures, skipped };
}

// Generate finals fixtures from top 4 teams
export function generateFinals(
  competitionId: string,
  standings: { teamId: string }[],
  baseScheduledAt: Date,
  slotPitchId: string
) {
  const top4 = standings.slice(0, 4);
  if (top4.length < 4) throw new Error("Need at least 4 teams for finals");

  const sf1Date = new Date(baseScheduledAt);
  const sf2Date = new Date(baseScheduledAt);
  sf2Date.setMinutes(sf2Date.getMinutes() + 60);
  const gfDate = new Date(baseScheduledAt);
  gfDate.setDate(gfDate.getDate() + 7);

  return [
    {
      homeTeamId: top4[0].teamId,
      awayTeamId: top4[3].teamId,
      round: 1,
      phase: "SEMI_FINAL" as const,
      pitchId: slotPitchId,
      scheduledAt: sf1Date,
      competitionId,
    },
    {
      homeTeamId: top4[1].teamId,
      awayTeamId: top4[2].teamId,
      round: 1,
      phase: "SEMI_FINAL" as const,
      pitchId: slotPitchId,
      scheduledAt: sf2Date,
      competitionId,
    },
    {
      homeTeamId: "TBD",
      awayTeamId: "TBD",
      round: 2,
      phase: "GRAND_FINAL" as const,
      pitchId: slotPitchId,
      scheduledAt: gfDate,
      competitionId,
    },
  ];
}
